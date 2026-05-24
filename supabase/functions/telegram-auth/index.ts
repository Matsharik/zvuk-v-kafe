import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Обработка CORS-запросов (когда React стучится с другого домена/локалхоста)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { initData } = await req.json()

    if (!initData) {
      return new Response(JSON.stringify({ error: 'initData missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Извлекаем BOT_TOKEN из переменных окружения Supabase
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN не настроен в инстансе Supabase')
    }

    // 2. Парсим строку initData, которую нам прислал фронтенд
    const urlParams = new URLSearchParams(initData)
    const hash = urlParams.get('hash')
    
    // Собираем data-check-string (все параметры, кроме hash, отсортированные по алфавиту)
    const dataCheckArr: string[] = []
    for (const [key, value] of urlParams.entries()) {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${value}`)
      }
    }
    dataCheckArr.sort()
    const dataCheckString = dataCheckArr.join('\n')

    // 3. Валидация подписи с помощью Web Crypto API (алгоритм Telegram)
    const encoder = new TextEncoder()
    
    // Шаг А: Секретный ключ = HMAC-SHA256("WebAppData", BOT_TOKEN)
    const webAppDataKey = await crypto.subtle.importKey(
      "raw", encoder.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    )
    const secretKeyBuffer = await crypto.subtle.sign(
      "HMAC", webAppDataKey, encoder.encode(botToken)
    )
    const secretKey = await crypto.subtle.importKey(
      "raw", secretKeyBuffer,
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    )

    // Шаг Б: Считаем финальный хеш от нашей dataCheckString
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC", secretKey, encoder.encode(dataCheckString)
    )
    
    // Переводим байты в HEX-строку
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Проверяем: совпадает ли наш посчитанный хеш с тем, что прислал Telegram?
    if (signature !== hash) {
      return new Response(JSON.stringify({ error: 'Цифровая подпись Telegram не валидна!' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. ПОДПИСЬ РЕАЛЬНАЯ. Извлекаем данные пользователя
    const userRaw = urlParams.get('user')
    if (!userRaw) throw new Error('Данные пользователя отсутствуют в initData')
    const tgUser = JSON.parse(userRaw)

    // Генерируем для него уникальные учетные данные в нашей системе
    const fakeEmail = `tg_${tgUser.id}@zvukvkafe.telegram`
    // Паролем будет хеш — заведение или хакер никогда его не угадают
    const fakePassword = `tg_secure_pass_${hash}` 

    // Инициализируем админский клиент Supabase (Service Role), чтобы создать юзера в обход подтверждений
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Ищем, есть ли уже этот аккаунт в Supabase Auth
    let { data: authUser, error: findError } = await supabaseAdmin.auth.admin.getUserById(tgUser.id.toString()).catch(() => ({ data: null, error: null }))

    // Если пользователя нет — регистрируем его встроенными методами админа
    if (!authUser?.user) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: fakeEmail,
        password: fakePassword,
        email_confirm: true, // Сразу подтверждаем email
        user_metadata: {
          first_name: tgUser.first_name + (tgUser.last_name ? ` ${tgUser.last_name}` : ''),
          username: tgUser.username ? `@${tgUser.username}` : null
        }
      })
      if (createError) throw createError
      authUser = createData
    }

    // Генерируем полноценную пользовательскую сессию (JWT токен)
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({
      email: fakeEmail,
      password: fakePassword
    })

    if (sessionError) throw sessionError

    // Возвращаем сессию на фронтенд
    return new Response(JSON.stringify({ session: sessionData.session }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})