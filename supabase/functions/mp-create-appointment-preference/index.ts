import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AppointmentRequest {
  service_ids: string[]
  scheduled_date: string
  time_slot: string
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

    const { service_ids, scheduled_date, time_slot }: AppointmentRequest = await req.json()

    if (!service_ids || service_ids.length === 0) {
      throw new Error('Nenhum serviço fornecido')
    }

    // Buscar perfil do cliente
    const { data: customerProfile } = await supabase
      .from('profiles')
      .select('id, user_id, full_name')
      .eq('user_id', user.id)
      .single()

    if (!customerProfile) {
      throw new Error('Perfil do cliente não encontrado')
    }

    // Buscar serviços
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, name, description, price, duration_minutes')
      .in('id', service_ids)
      .eq('is_active', true)

    if (servicesError || !services || services.length === 0) {
      throw new Error('Serviços não encontrados ou inativos')
    }

    // Calcular totais
    let totalAmount = 0
    const preferenceItems = []

    for (const service of services) {
      totalAmount += Number(service.price)
      
      preferenceItems.push({
        title: service.name,
        description: service.description || `Agendamento para ${scheduled_date}`,
        quantity: 1,
        unit_price: Number(service.price),
        currency_id: 'BRL'
      })
    }

    // Usar as credenciais do Mercado Pago dos secrets
    const clientId = Deno.env.get('MP_CLIENT_ID')
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais do Mercado Pago não configuradas')
    }

    // Obter access token público (para agendamentos não usamos tokens de vendedor específico)
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
    const preferenceData = {
      items: preferenceItems,
      payer: {
        name: customerProfile.full_name,
        email: user.email
      },
      back_urls: {
        success: `${req.headers.get('origin')}/agendamento-confirmado`,
        failure: `${req.headers.get('origin')}/agendamento-erro`,
        pending: `${req.headers.get('origin')}/agendamento-pendente`
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhooks`,
      external_reference: `appointment_${Date.now()}_${customerProfile.id}`,
      metadata: {
        customer_id: customerProfile.id,
        service_ids: service_ids.join(','),
        scheduled_date,
        time_slot,
        type: 'appointment'
      }
    }

    console.log('Criando preferência para agendamento:', JSON.stringify(preferenceData, null, 2))

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
    console.log('Preferência para agendamento criada:', { id: preference.id, init_point: preference.init_point })

    // Mapear turno para horário específico
    const getTimeForSlot = (timeSlot: string) => {
      switch (timeSlot) {
        case 'morning': return '09:00:00'
        case 'afternoon': return '14:00:00' 
        case 'evening': return '18:00:00'
        default: return '09:00:00'
      }
    }

    // Criar agendamentos pendentes
    const appointmentPromises = service_ids.map(async (serviceId) => {
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          customer_id: customerProfile.id,
          service_id: serviceId,
          scheduled_time: new Date(`${scheduled_date} ${getTimeForSlot(time_slot)}`).toISOString(),
          status: 'pending_payment',
          booking_type: 'app',
          notes: `Turno: ${time_slot} - Preferência MP: ${preference.id}`
        })
        .select()
        .single()

      if (error) throw error
      return appointment
    })

    const appointments = await Promise.all(appointmentPromises)

    return new Response(
      JSON.stringify({
        preference_id: preference.id,
        init_point: preference.init_point,
        appointment_ids: appointments.map(a => a.id),
        total_amount: totalAmount
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Erro ao criar preferência de agendamento:', error)
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