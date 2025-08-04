import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.170.0/node/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Ler body da requisição com tratamento robusto
    const body = await req.text()
    console.log('Body recebido:', body)
    
    if (!body || body.trim() === '') {
      console.log('Body vazio recebido')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    let data
    try {
      data = JSON.parse(body)
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError)
      console.log('Body que causou erro:', body)
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    console.log('Webhook recebido:', data)

    // Extrair ID do recurso dependendo do formato do webhook
    let resourceId = null
    if (data.data?.id) {
      resourceId = data.data.id
    } else if (data.resource) {
      // Extrair ID da URL do resource (ex: https://api.mercadolibre.com/merchant_orders/123)
      resourceId = data.resource.split('/').pop()
    } else if (data.id) {
      resourceId = data.id
    }

    console.log('Resource ID extraído:', resourceId, 'Topic:', data.topic, 'Type:', data.type)

    if (!resourceId) {
      console.log('Nenhum ID de recurso encontrado')
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    // Validar assinatura do webhook (opcional)
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    
    // Por ora, vamos pular a validação de assinatura para evitar erros
    // TODO: Implementar validação quando tiver o secret configurado
    if (xSignature && xRequestId && false) {
      console.log('Validação de assinatura desabilitada temporariamente')
    }

    // Verificar se já processamos este evento (idempotência)
    const eventId = data.data?.id || data.id
    if (eventId) {
      const { data: existingEvent } = await supabase
        .from('processed_webhook_events')
        .select('id')
        .eq('event_id', eventId.toString())
        .single()

      if (existingEvent) {
        console.log('Evento já processado:', eventId)
        return new Response('OK', { status: 200 })
      }
    }

    // Responder rapidamente ao MP
    const quickResponse = new Response('OK', { status: 200 })

    // Processar webhook baseado no tipo
    if (data.topic === 'payment' || data.type === 'payment') {
      await processPaymentWebhook(supabase, data)
    } else if (data.topic === 'merchant_order' || data.type === 'merchant_order') {
      await processMerchantOrderWebhook(supabase, data)
    }

    // Marcar evento como processado
    if (eventId) {
      await supabase
        .from('processed_webhook_events')
        .insert([{
          event_id: eventId.toString(),
          event_type: data.topic || data.type || 'unknown'
        }])
    }

    return quickResponse

  } catch (error) {
    console.error('Erro no webhook:', error)
    // Sempre retornar 200 para o MP para evitar reenvios desnecessários
    return new Response('OK', { status: 200, headers: corsHeaders })
  }
})

async function processPaymentWebhook(supabase: any, data: any) {
  try {
    const paymentId = data.data?.id
    if (!paymentId) return

    console.log('Processando pagamento:', paymentId)

    // Obter access token do Mercado Pago
    const clientId = Deno.env.get('MP_CLIENT_ID')
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET')
    
    if (!clientId || !clientSecret) {
      console.error('Credenciais do Mercado Pago não configuradas')
      return
    }

    // Obter access token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Erro ao obter token do MP:', tokenResponse.status)
      return
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Buscar detalhes do pagamento
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!paymentResponse.ok) {
      console.error('Erro ao buscar pagamento no MP:', paymentResponse.status)
      return
    }

    const payment = await paymentResponse.json()
    console.log('Detalhes do pagamento:', { 
      id: payment.id, 
      status: payment.status, 
      external_reference: payment.external_reference,
      order: payment.order,
      metadata: payment.metadata,
      application_fee: payment.fee_details?.find((f: any) => f.type === 'application_fee')?.amount || 0
    })

    // Processar split de pagamento se houver order_id no metadata
    if (payment.metadata?.order_id) {
      await processSplitPayment(supabase, payment)
    }

    // Buscar agendamentos pendentes - vamos tentar múltiplas abordagens
    let pendingAppointments = null
    let error = null

    // 1. Tentar buscar pelo preference_id se disponível
    const preferenceId = payment.order?.preference_id || payment.metadata?.preference_id
    if (preferenceId) {
      console.log('Buscando agendamentos pelo preference_id:', preferenceId)
      const result = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'pending_payment')
        .ilike('notes', `%${preferenceId}%`)
      
      pendingAppointments = result.data
      error = result.error
    }

    // 2. Se não encontrou, tentar buscar pelo external_reference 
    if ((!pendingAppointments || pendingAppointments.length === 0) && payment.external_reference) {
      console.log('Buscando agendamentos pelo external_reference:', payment.external_reference)
      const result = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'pending_payment')
        
      // Filtrar manualmente pela external_reference que contém o customer_id
      if (result.data) {
        const customerIdFromRef = payment.external_reference.split('_').pop()
        console.log('Customer ID extraído da external_reference:', customerIdFromRef)
        
        const filteredAppointments = result.data.filter(apt => apt.customer_id === customerIdFromRef)
        if (filteredAppointments.length > 0) {
          pendingAppointments = filteredAppointments
        }
      }
      
      if (!pendingAppointments || pendingAppointments.length === 0) {
        pendingAppointments = result.data
      }
      error = result.error
    }

    if (error) {
      console.error('Erro ao buscar agendamentos pendentes:', error)
      return
    }

    if (pendingAppointments && pendingAppointments.length > 0) {
      console.log('Confirmando agendamentos após pagamento aprovado')
      
      for (const appointment of pendingAppointments) {
        // Atualizar status do agendamento apenas se o pagamento foi aprovado
        if (payment.status === 'approved') {
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ 
              status: 'scheduled',
              notes: `Pagamento confirmado: ${paymentId} - Status: ${payment.status}`
            })
            .eq('id', appointment.id)

          if (updateError) {
            console.error('Erro ao atualizar agendamento:', updateError)
          } else {
            console.log('Agendamento confirmado:', appointment.id)
          }
        } else {
          console.log('Pagamento não aprovado, status:', payment.status)
        }
      }
    } else {
      console.log('Nenhum agendamento pendente encontrado para este pagamento')
    }
    
    console.log('Pagamento processado:', paymentId)
    
  } catch (error) {
    console.error('Erro ao processar payment webhook:', error)
  }
}

async function processSplitPayment(supabase: any, payment: any) {
  try {
    const orderId = payment.metadata.order_id
    const paymentId = payment.id.toString()
    
    console.log('Processando split payment para order:', orderId)

    // Buscar dados do pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Erro ao buscar pedido:', orderError)
      return
    }

    // Mapear status do Mercado Pago para nosso sistema
    let orderStatus = 'pending'
    let splitStatus = 'pending'

    switch (payment.status) {
      case 'approved':
        orderStatus = 'paid'
        splitStatus = 'approved'
        break
      case 'pending':
        orderStatus = 'pending'
        splitStatus = 'pending'
        break
      case 'cancelled':
      case 'rejected':
        orderStatus = 'cancelled'
        splitStatus = 'rejected'
        break
      default:
        orderStatus = payment.status
        splitStatus = payment.status
    }

    // Calcular valores do split
    const applicationFee = payment.fee_details?.find((f: any) => f.type === 'application_fee')?.amount || 0
    const sellerAmount = payment.transaction_amount - applicationFee

    // Atualizar status do pedido
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ 
        status: orderStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (orderUpdateError) {
      console.error('Erro ao atualizar pedido:', orderUpdateError)
    }

    // Criar ou atualizar registro de split payment
    const { error: splitError } = await supabase
      .from('split_payments')
      .upsert({
        order_id: orderId,
        payment_id: paymentId,
        total_amount: payment.transaction_amount,
        seller_amount: sellerAmount,
        marketplace_fee: applicationFee,
        mp_collector_id: payment.collector_id,
        status: splitStatus,
        processed_at: splitStatus === 'approved' ? new Date().toISOString() : null
      }, {
        onConflict: 'payment_id'
      })

    if (splitError) {
      console.error('Erro ao criar/atualizar split payment:', splitError)
    }

    // Se aprovado, reduzir estoque dos produtos
    if (splitStatus === 'approved') {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', orderId)

      if (orderItems) {
        for (const item of orderItems) {
          const { error: stockError } = await supabase
            .from('products')
            .update({ 
              stock_quantity: supabase.sql`stock_quantity - ${item.quantity}` 
            })
            .eq('id', item.product_id)

          if (stockError) {
            console.error('Erro ao reduzir estoque:', stockError)
          }
        }
      }
    }

    console.log(`Split payment processado: order=${orderId}, payment=${paymentId}, status=${splitStatus}, seller_amount=${sellerAmount}, marketplace_fee=${applicationFee}`)
    
  } catch (error) {
    console.error('Erro ao processar split payment:', error)
  }
}

async function processMerchantOrderWebhook(supabase: any, data: any) {
  try {
    let orderId = null
    if (data.data?.id) {
      orderId = data.data.id
    } else if (data.resource) {
      orderId = data.resource.split('/').pop()
    }
    
    if (!orderId) {
      console.log('Nenhum order ID encontrado')
      return
    }

    console.log('Processando merchant order:', orderId)
    
    // Obter access token do Mercado Pago
    const clientId = Deno.env.get('MP_CLIENT_ID')
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET')
    
    if (!clientId || !clientSecret) {
      console.error('Credenciais do Mercado Pago não configuradas')
      return
    }

    // Obter access token
    const tokenResponse = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenResponse.ok) {
      console.error('Erro ao obter token para merchant order:', tokenResponse.status)
      return
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Buscar detalhes da merchant order
    const orderResponse = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })

    if (!orderResponse.ok) {
      console.error('Erro ao buscar merchant order no MP:', orderResponse.status)
      return
    }

    const order = await orderResponse.json()
    console.log('Detalhes da merchant order:', {
      id: order.id,
      order_status: order.order_status,
      preference_id: order.preference_id,
      payments: order.payments?.map((p: any) => ({ id: p.id, status: p.status }))
    })

    // Se há pagamentos aprovados, vamos buscar e confirmar os agendamentos
    const approvedPayments = order.payments?.filter((p: any) => p.status === 'approved') || []
    
    if (approvedPayments.length > 0 && order.preference_id) {
      console.log('Merchant order com pagamentos aprovados, confirmando agendamentos...')
      
      // Buscar agendamentos pelo preference_id
      const { data: pendingAppointments, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'pending_payment')
        .ilike('notes', `%${order.preference_id}%`)

      if (error) {
        console.error('Erro ao buscar agendamentos pendentes:', error)
        return
      }

      if (pendingAppointments && pendingAppointments.length > 0) {
        console.log(`Encontrados ${pendingAppointments.length} agendamentos para confirmar`)
        
        for (const appointment of pendingAppointments) {
          const { error: updateError } = await supabase
            .from('appointments')
            .update({ 
              status: 'scheduled',
              notes: `Pagamento confirmado via merchant order: ${orderId} - Payments: ${approvedPayments.map((p: any) => p.id).join(', ')}`
            })
            .eq('id', appointment.id)

          if (updateError) {
            console.error('Erro ao atualizar agendamento:', updateError)
          } else {
            console.log('Agendamento confirmado via merchant order:', appointment.id)
          }
        }
      } else {
        console.log('Nenhum agendamento pendente encontrado para esta merchant order')
      }
    }
    
  } catch (error) {
    console.error('Erro ao processar merchant order webhook:', error)
  }
}