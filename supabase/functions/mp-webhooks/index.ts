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

    // Ler body da requisição
    const body = await req.text()
    const data = JSON.parse(body)

    console.log('Webhook recebido:', data)

    // Validar assinatura do webhook (opcional mas recomendado)
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    
    if (xSignature && xRequestId) {
      // Buscar secret do webhook
      const { data: webhookSecret } = await supabase
        .from('vault.decrypted_secrets')
        .select('secret')
        .eq('name', 'MP_WEBHOOK_SECRET')
        .single()

      if (webhookSecret) {
        // Validar assinatura conforme documentação MP
        const parts = xSignature.split(',')
        const ts = parts.find(part => part.startsWith('ts='))?.replace('ts=', '')
        const v1 = parts.find(part => part.startsWith('v1='))?.replace('v1=', '')

        if (ts && v1) {
          const manifest = `id:${data.data?.id};request-id:${xRequestId};ts:${ts};`
          const calculatedSignature = createHmac('sha256', webhookSecret.secret)
            .update(manifest)
            .digest('hex')

          if (calculatedSignature !== v1) {
            console.error('Assinatura inválida do webhook')
            return new Response('Unauthorized', { status: 401 })
          }
        }
      }
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
    return new Response('Internal Server Error', { status: 500 })
  }
})

async function processPaymentWebhook(supabase: any, data: any) {
  try {
    const paymentId = data.data?.id
    if (!paymentId) return

    console.log('Processando pagamento:', paymentId)

    // Buscar detalhes do pagamento via API MP
    // Precisaria do access_token do vendedor, mas como não sabemos qual vendedor,
    // vamos buscar o pedido pela preference_id quando possível
    
    // Por ora, vamos apenas logar
    console.log('Pagamento atualizado:', paymentId)
    
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