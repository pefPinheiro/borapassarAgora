# Configuração do Login com Google no Supabase

Para que o login com Google funcione, você precisa configurar o provedor no Google Cloud Platform e no Supabase. Siga os passos abaixo utilizando a URL do seu projeto.

## Passo 1: Google Cloud Platform (GCP)

1.  Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2.  Crie um novo projeto (ex: `Bora Passar Agora`).
3.  No menu lateral, vá em **APIs e Serviços** > **Tela de permissão OAuth**.
    *   Selecione **Externo** e clique em **Criar**.
    *   Preencha as informações do app (Nome, E-mail de suporte, etc.).
    *   Salver e continuar (não precisa adicionar escopos sensíveis agora).
4.  Vá em **Credenciais** > **Criar Credenciais** > **ID do cliente OAuth**.
    *   Tipo de aplicativo: **Aplicação da Web**.
    *   Nome: `Supabase Auth`.
    *   **Origens JavaScript autorizadas**:
        *   Adicione: `https://qkxincrpiazfyveilogn.supabase.co`
    *   **URIs de redirecionamento autorizados**:
        *   Adicione: `https://qkxincrpiazfyveilogn.supabase.co/auth/v1/callback`
5.  Clique em **Criar**.
6.  Copie o **ID do cliente** e a **Chave secreta do cliente**.

## Passo 2: Supabase Dashboard

1.  Acesse seu painel no [Supabase](https://supabase.com/dashboard).
2.  Vá em **Authentication** > **Providers**.
3.  Clique em **Google**.
4.  Ative a opção **Enable Google**.
5.  Cole o **Client ID** e o **Client Secret** que você copiou do Google Cloud.
6.  Clique em **Save**.

## Passo 3: Configuração de URL no Supabase

1.  Vá em **Authentication** > **URL Configuration**.
2.  Em **Site URL**, coloque a URL de desenvolvimento local:
    *   `http://localhost:5173`
3.  Em **Redirect URLs**, certifique-se de que a seguinte URL está listada para permitir o redirecionamento local:
    *   `http://localhost:5173/**`
4.  Quando for colocar o site no ar, adicione a URL de produção aqui também.

Após fazer isso, o botão de "Entrar com Google" no seu site deve funcionar corretamente!
