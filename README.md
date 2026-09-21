# GAID CRM

CRM estratégico para infoprodutos: pipelines customizáveis, campanhas, scripts,
objeções, validação de produto e tarefas — com métricas calculadas 100% a
partir dos dados reais cadastrados.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (geralmente http://localhost:5173).

## Publicar no Vercel

1. Crie um repositório no GitHub e suba esta pasta:
   ```bash
   git init
   git add .
   git commit -m "GAID CRM"
   git branch -M main
   git remote add origin SEU_REPO_AQUI
   git push -u origin main
   ```
2. Entre em [vercel.com](https://vercel.com), clique em **Add New → Project**
   e importe esse repositório.
3. O Vercel detecta automaticamente que é um projeto Vite — não precisa mudar
   nenhuma configuração. Clique em **Deploy**.

## Importante sobre os dados

Este projeto guarda os dados no `localStorage` do navegador — ou seja, cada
pessoa que acessar o link vai ter o **próprio** CRM, salvo só no aparelho/
navegador dela. Os dados não são compartilhados entre pessoas nem sincronizam
entre dispositivos diferentes.

Se a ideia é que várias pessoas (ex: você e um vendedor) vejam os mesmos leads
em tempo real, o próximo passo é trocar o `localStorage` por um banco de dados
de verdade (ex: Supabase, Firebase ou uma API própria). Posso te ajudar a
fazer essa troca quando quiser.
