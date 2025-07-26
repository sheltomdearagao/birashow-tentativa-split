import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentRequest {
  appointment_id: string
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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Unauthorized')
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { appointment_id }: PaymentRequest = await req.json()

    if (!appointment_id) {
      throw new Error('ID do agendamento é obrigatório')
    }

    // Buscar o agendamento com os dados do serviço e cliente
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        services:service_id (
          id, name, description, price, duration_minutes
        ),
        profiles:customer_id (
          id, user_id, full_name
        )
      `)
      .eq('id', appointment_id)
      .eq('status', 'pending_payment')
      .single()

    if (appointmentError || !appointment) {
      throw new Error('Agendamento não encontrado ou não está pendente de pagamento')
    }

    // Verificar se o usuário é o dono do agendamento
    if (appointment.profiles.user_id !== user.id) {
      throw new Error('Acesso negado - este agendamento não pertence ao usuário')
    }

    // Usar as credenciais do Mercado Pago dos secrets
    const clientId = Deno.env.get('MP_CLIENT_ID')
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais do Mercado Pago não configuradas')
    }

    // Obter access token público
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
      throw new Error('Erro ao obter token do Mercado Pago')
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Criar preferência no Mercado Pago
    const scheduledDate = new Date(appointment.scheduled_time).toISOString().split('T')[0]
    
    const preferenceData = {
      items: [{
        title: appointment.services.name,
        description: appointment.services.description || `Agendamento para ${scheduledDate}`,
        quantity: 1,
        unit_price: Number(appointment.services.price),
        currency_id: 'BRL'
      }],
      payer: {
        name: appointment.profiles.full_name,
        email: user.email
      },
      back_urls: {
        success: `${req.headers.get('origin')}/agendamento-confirmado`,
        failure: `${req.headers.get('origin')}/agendamento-erro`,
        pending: `${req.headers.get('origin')}/agendamento-pendente`
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhooks`,
      external_reference: `appointment_retry_${Date.now()}_${appointment.profiles.id}`,
      metadata: {
        customer_id: appointment.profiles.id,
        appointment_id: appointment.id,
        service_id: appointment.services.id,
        scheduled_date: scheduledDate,
        type: 'appointment_retry'
      }
    }

    console.log('Criando nova preferência para agendamento existente:', JSON.stringify(preferenceData, null, 2))

    const preferenceResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preferenceData)
    })

    if (!preferenceResponse.ok) {
      const errorText = await preferenceResponse.text()
      console.error('Erro ao criar preferência MP:', errorText)
      throw new Error(`Erro ao criar preferência: ${preferenceResponse.status}`)
    }

    const preference = await preferenceResponse.json()
    console.log('Nova preferência criada para agendamento:', { id: preference.id, init_point: preference.init_point })

    // Atualizar o agendamento com a nova preferência
    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        notes: `Preferência MP atualizada: ${preference.id}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment_id)

    if (updateError) {
      console.error('Erro ao atualizar agendamento:', updateError)
      // Não falhar aqui, pois a preferência foi criada com sucesso
    }

    return new Response(
      JSON.stringify({
        preference_id: preference.id,
        init_point: preference.init_point,
        appointment_id: appointment.id,
        amount: Number(appointment.services.price)
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Erro ao criar preferência de pagamento:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})