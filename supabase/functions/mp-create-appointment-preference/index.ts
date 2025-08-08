import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AppointmentRequest {
  service_ids: string[]
  scheduled_date: string
  time_slot: string
  app_base_url?: string
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

const { service_ids, scheduled_date, time_slot, app_base_url }: AppointmentRequest = await req.json()

    // Determine app base URL for Mercado Pago back_urls
    const originHeader = req.headers.get('origin') || undefined
    const refererHeader = req.headers.get('referer') || undefined
    let refererOrigin: string | undefined = undefined
    try {
      refererOrigin = refererHeader ? new URL(refererHeader).origin : undefined
    } catch (_) {
      refererOrigin = undefined
    }
    const baseUrl = app_base_url || originHeader || refererOrigin
    if (!baseUrl) {
      throw new Error('Não foi possível determinar a URL base do aplicativo para os redirecionamentos.')
    }

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
      .select('id, name, description, price, duration_minutes, seller_id')
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

    // Determinar vendedor a partir dos serviços selecionados
    const sellerUserIds = Array.from(new Set((services as any[]).map(s => s.seller_id).filter(Boolean))) as string[]
    if (sellerUserIds.length === 0) {
      throw new Error('Serviços sem vendedor associado. Configure o vendedor do(s) serviço(s).')
    }
    if (sellerUserIds.length > 1) {
      throw new Error('Selecione serviços de um único vendedor por transação.')
    }
    const sellerUserId = sellerUserIds[0]

    // Obter token do vendedor (obrigatório para split)
    let accessToken: string | null = null
    const { data: tokenRow } = await supabase
      .from('mp_oauth_tokens')
      .select('encrypted_access_token')
      .eq('user_id', sellerUserId)
      .maybeSingle()

    if (tokenRow?.encrypted_access_token) {
      accessToken = atob(tokenRow.encrypted_access_token)
      console.log('Usando token do vendedor para criar preferência de agendamento (split). Vendedor user_id:', sellerUserId)
    } else {
      throw new Error('Vendedor não conectado ao Mercado Pago.')
    }

    // Criar preferência no Mercado Pago
    // Buscar sponsor_id (user id da conta da plataforma) na configuração
    const { data: mpConfig } = await supabase
      .from('marketplace_config')
      .select('mercado_pago_user_id')
      .eq('is_active', true)
      .maybeSingle()

    const preferenceData: any = {
      items: preferenceItems,
      payer: {
        name: customerProfile.full_name,
        email: user.email
      },
      back_urls: {
        success: `${baseUrl}/agendamento-confirmado`,
        failure: `${baseUrl}/agendamento-erro`,
        pending: `${baseUrl}/agendamento-pendente`
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhooks`,
      external_reference: `appointment_${Date.now()}_${customerProfile.id}`,
      metadata: {
        customer_id: customerProfile.id,
        service_ids: service_ids.join(','),
        scheduled_date,
        time_slot,
        type: 'appointment',
        seller_user_id: sellerUserId
      },
      marketplace_fee: 1.00,
      ...(mpConfig?.mercado_pago_user_id ? { sponsor_id: Number(mpConfig.mercado_pago_user_id) } : {})
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
      throw new Error(`Erro ao criar preferência: ${preferenceResponse.status} - ${errorText}`)
    }

    const preference = await preferenceResponse.json()
    console.log('Preferência para agendamento criada:', { id: preference.id, init_point: preference.init_point })

    // Buscar próxima posição disponível na fila para o turno escolhido
    const { data: existingAppointments, error: queueError } = await supabase
      .from('appointments')
      .select('queue_position')
      .gte('scheduled_time', `${scheduled_date}T00:00:00-03:00`)
      .lt('scheduled_time', `${scheduled_date}T23:59:59-03:00`)
      .eq('time_slot', time_slot)
      .eq('status', 'scheduled')
      .order('queue_position', { ascending: true })

    if (queueError) {
      console.error('Erro ao buscar fila:', queueError)
      throw queueError
    }

    // Encontrar primeira posição disponível (1-5)
    const occupiedPositions = existingAppointments?.map(apt => apt.queue_position).filter(pos => pos !== null) || []
    let nextPosition = 1
    for (let i = 1; i <= 5; i++) {
      if (!occupiedPositions.includes(i)) {
        nextPosition = i
        break
      }
    }

    // Verificar se há posição disponível
    if (nextPosition > 5 || occupiedPositions.length >= 5) {
      throw new Error('Turno lotado. Escolha outro horário.')
    }

    // Mapear turno para horário específico (apenas para referência)
    const getTimeForSlot = (timeSlot: string) => {
      switch (timeSlot) {
        case 'morning': return '10:00:00'
        case 'afternoon': return '14:00:00' 
        case 'evening': return '18:00:00'
        default: return '10:00:00'
      }
    }

    // Criar agendamentos pendentes com posição reservada
    const appointmentPromises = service_ids.map(async (serviceId) => {
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          customer_id: user.id,
          service_id: serviceId,
          scheduled_time: new Date(`${scheduled_date} ${getTimeForSlot(time_slot)}`).toISOString(),
          status: 'pending_payment',
          booking_type: 'app',
          notes: `Turno: ${time_slot} - Posição: ${nextPosition} - Preferência MP: ${preference.id}`,
          time_slot: time_slot,
          queue_position: nextPosition
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