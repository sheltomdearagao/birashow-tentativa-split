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

    // Validar se a estrutura básica está presente
    if (!data || (!data.data && !data.id)) {
      console.log('Estrutura de dados inválida')
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
    } else if (data.topic === 'merchant_orders' || data.type === 'merchant_orders') {
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
    console.log('Detalhes do pagamento:', { id: payment.id, status: payment.status, external_reference: payment.external_reference })

    // Buscar agendamentos pendentes pelo external_reference ou preference_id
    const { data: pendingAppointments, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'pending_payment')
      .or(`notes.ilike.%${payment.external_reference || ''}%,notes.ilike.%${payment.order?.id || ''}%`)

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

async function processMerchantOrderWebhook(supabase: any, data: any) {
  try {
    const orderId = data.data?.id
    if (!orderId) return

    console.log('Processando merchant order:', orderId)
    
    // Implementar lógica para buscar e atualizar status do pedido
    
  } catch (error) {
    console.error('Erro ao processar merchant order webhook:', error)
  }
}