import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PreferenceItem {
  product_id: string
  quantity: number
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

    const { items, marketplace_fee_percentage = 10 }: { 
      items: PreferenceItem[], 
      marketplace_fee_percentage?: number 
    } = await req.json()

    if (!items || items.length === 0) {
      throw new Error('Nenhum item fornecido')
    }

    // Buscar perfil do comprador
    const { data: buyerProfile } = await supabase
      .from('profiles')
      .select('id, user_id')
      .eq('user_id', user.id)
      .single()

    if (!buyerProfile) {
      throw new Error('Perfil do comprador não encontrado')
    }

    // Buscar produtos e validar
    const productIds = items.map(item => item.product_id)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, description, price, seller_id, stock_quantity')
      .in('id', productIds)
      .eq('is_active', true)

    if (productsError || !products || products.length === 0) {
      throw new Error('Produtos não encontrados ou inativos')
    }

    // Validar estoque
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id)
      if (!product) {
        throw new Error(`Produto ${item.product_id} não encontrado`)
      }
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Estoque insuficiente para ${product.name}`)
      }
    }

    // Agrupar por vendedor (assumindo um vendedor por pedido por simplicidade)
    const sellerId = products[0].seller_id
    const sellerProducts = products.filter(p => p.seller_id === sellerId)
    
    if (sellerProducts.length !== products.length) {
      throw new Error('Todos os produtos devem ser do mesmo vendedor')
    }

    // Buscar tokens do vendedor
    const { data: sellerTokens } = await supabase
      .from('mp_oauth_tokens')
      .select('encrypted_access_token, seller_id')
      .eq('seller_id', sellerId)
      .single()

    if (!sellerTokens) {
      throw new Error('Vendedor não conectado ao Mercado Pago')
    }

    // Descriptografar access token (base64 simples por ora)
    const accessToken = atob(sellerTokens.encrypted_access_token)

    // Calcular totais
    let totalAmount = 0
    const preferenceItems = []

    for (const item of items) {
      const product = products.find(p => p.id === item.product_id)
      if (product) {
        const itemTotal = Number(product.price) * item.quantity
        totalAmount += itemTotal

        preferenceItems.push({
          title: product.name,
          description: product.description || '',
          quantity: item.quantity,
          unit_price: Number(product.price),
          currency_id: 'BRL'
        })
      }
    }

    // Calcular taxa do marketplace
    const marketplaceFee = (totalAmount * marketplace_fee_percentage) / 100

    // Criar preferência no Mercado Pago
    const preferenceData = {
      items: preferenceItems,
      marketplace_fee: marketplaceFee,
      back_urls: {
        success: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-payment-success`,
        failure: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-payment-failure`,
        pending: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-payment-pending`
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhooks`
    }

    console.log('Criando preferência:', JSON.stringify(preferenceData, null, 2))

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
    console.log('Preferência criada:', { id: preference.id, init_point: preference.init_point })

    // Criar pedido no banco
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        buyer_id: buyerProfile.id,
        seller_id: sellerId,
        total_amount: totalAmount,
        marketplace_fee: marketplaceFee,
        mp_preference_id: preference.id,
        status: 'pending'
      }])
      .select('id')
      .single()

    if (orderError) {
      console.error('Erro ao criar pedido:', orderError)
      throw new Error('Erro ao criar pedido')
    }

    // Criar itens do pedido
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id)
      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: Number(product!.price),
        total_price: Number(product!.price) * item.quantity
      }
    })

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Erro ao criar itens do pedido:', itemsError)
      throw new Error('Erro ao criar itens do pedido')
    }

    return new Response(
      JSON.stringify({
        preference_id: preference.id,
        init_point: preference.init_point,
        order_id: order.id,
        total_amount: totalAmount,
        marketplace_fee: marketplaceFee
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Erro ao criar preferência:', error)
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