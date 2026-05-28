import { createClient } from '@supabase/supabase-js'

// Substitua com as credenciais que você pegou no painel do Supabase
const supabaseUrl = 'Shttps://stgyxwctvsyqlmkzftzs.supabase.co/rest/v1/'
const supabaseKey = 'SUA_ANON_PUBLIC_KEY_AQUeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0Z3l4d2N0dnN5cWxta3pmdHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MjYwODksImV4cCI6MjA5NTUwMjA4OX0.36SzR2UcRre05qBsZ0ekxyFs_ge6w5ox2ucVohzeSSUI'

export const supabase = createClient(supabaseUrl, supabaseKey)