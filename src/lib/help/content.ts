export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

export interface HelpCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const helpCategories: HelpCategory[] = [
  {
    id: 'getting-started',
    name: 'Começando',
    icon: 'bx-rocket',
    description: 'Primeiros passos e configuração inicial'
  },
  {
    id: 'transactions',
    name: 'Transações',
    icon: 'bx-swap-horizontal',
    description: 'Como adicionar, editar e importar transações'
  },
  {
    id: 'budgets',
    name: 'Orçamentos',
    icon: 'bx-wallet-alt',
    description: 'Criar e gerenciar orçamentos e projeções'
  },
  {
    id: 'goals',
    name: 'Metas e Objetivos',
    icon: 'bx-bullseye',
    description: 'Criar metas e acompanhar seu progresso'
  },
  {
    id: 'debts-investments',
    name: 'Dívidas e Investimentos',
    icon: 'bx-trending-up',
    description: 'Gerenciar dívidas e registrar investimentos'
  },
  {
    id: 'reports',
    name: 'Relatórios',
    icon: 'bx-bar-chart',
    description: 'Gerar relatórios e entender gráficos'
  },
  {
    id: 'integrations',
    name: 'Integrações',
    icon: 'bx-share',
    description: 'Conectar bancos e importar dados'
  },
  {
    id: 'advisor',
    name: 'AI Advisor',
    icon: 'bx-sparkles',
    description: 'Como usar o advisor de IA e limites'
  },
  {
    id: 'account',
    name: 'Conta e Assinatura',
    icon: 'bx-user',
    description: 'Perfil, planos e cobrança'
  }
];

export const helpArticles: HelpArticle[] = [
  // Começando
  {
    id: 'getting-started-1',
    title: 'Bem-vindo ao c2Finance',
    content: `O c2Finance é uma plataforma completa para gerenciar suas finanças pessoais com o poder da inteligência artificial.

**O que você pode fazer:**
- Registrar todas as suas transações financeiras
- Criar orçamentos e acompanhar seus gastos
- Definir metas financeiras e objetivos
- Gerenciar dívidas e investimentos
- Receber insights e recomendações do AI Advisor
- Gerar relatórios detalhados

Comece criando suas primeiras contas e categorias para organizar suas finanças!`,
    category: 'getting-started',
    tags: ['início', 'introdução', 'primeiros passos']
  },
  {
    id: 'getting-started-2',
    title: 'Criando sua primeira conta',
    content: `As contas representam onde seu dinheiro está guardado (banco, carteira, investimentos, etc).

**Como criar uma conta:**
1. Vá até a seção "Contas" no menu lateral
2. Clique em "Nova Conta"
3. Preencha os dados:
   - Nome da conta (ex: "Conta Corrente Nubank")
   - Tipo: Corrente, Poupança, Crédito ou Investimento
   - Saldo inicial (opcional)
   - Instituição financeira (opcional)

**Dica:** Você pode criar quantas contas precisar para organizar melhor suas finanças!`,
    category: 'getting-started',
    tags: ['contas', 'criar', 'primeira conta']
  },
  {
    id: 'getting-started-3',
    title: 'Criando categorias',
    content: `As categorias ajudam a organizar suas receitas e despesas.

**Como criar categorias:**
1. Acesse "Categorias" no menu
2. Clique em "Nova Categoria"
3. Escolha o tipo: Receita ou Despesa
4. Defina nome, ícone e cor

**Categorias sugeridas para despesas:**
- Alimentação
- Transporte
- Moradia
- Saúde
- Educação
- Lazer
- Outros

**Categorias sugeridas para receitas:**
- Salário
- Freelance
- Investimentos
- Outros

Você pode criar quantas categorias precisar!`,
    category: 'getting-started',
    tags: ['categorias', 'organização', 'receitas', 'despesas']
  },
  {
    id: 'getting-started-4',
    title: 'Configurando seu perfil',
    content: `Configure seu perfil para personalizar sua experiência e receber recomendações mais precisas.

**Informações do perfil:**
- Nome completo
- Foto de perfil
- Localização (estado e cidade)
- Data de nascimento
- Gênero
- Renda mensal média

**Por que configurar?**
- O AI Advisor usa essas informações para dar recomendações personalizadas
- A renda mensal ajuda a calcular automaticamente sua reserva de emergência
- A localização permite análises regionais

Acesse "Configurações" no menu para atualizar seu perfil.`,
    category: 'getting-started',
    tags: ['perfil', 'configuração', 'dados pessoais']
  },

  // Transações
  {
    id: 'transactions-1',
    title: 'Como adicionar uma transação',
    content: `Registre todas as suas movimentações financeiras para ter controle total.

**Passos para adicionar:**
1. Vá até "Transações" no menu
2. Clique em "Nova Transação"
3. Preencha os dados:
   - Data da transação
   - Descrição
   - Valor (use negativo para despesas, positivo para receitas)
   - Conta de origem/destino
   - Categoria (opcional, mas recomendado)
   - Observações (opcional)

**Dica:** Use valores negativos para despesas e positivos para receitas. O sistema calcula automaticamente o saldo da conta.`,
    category: 'transactions',
    tags: ['transações', 'adicionar', 'registrar']
  },
  {
    id: 'transactions-2',
    title: 'Importando transações (CSV/OFX)',
    content: `Importe extratos bancários para economizar tempo.

**Formatos suportados:**
- CSV (Excel, planilhas)
- OFX (formato bancário padrão)

**Como importar:**
1. Vá até "Transações"
2. Clique em "Importar"
3. Selecione o arquivo CSV ou OFX
4. Revise os dados importados
5. Confirme a importação

**Dicas:**
- A maioria dos bancos permite exportar extratos em CSV ou OFX
- O sistema detecta automaticamente duplicatas
- Revise sempre os dados antes de confirmar
- Você pode importar múltiplos arquivos

**Importante:** Certifique-se de que o arquivo está no formato correto antes de importar.`,
    category: 'transactions',
    tags: ['importar', 'csv', 'ofx', 'extrato']
  },
  {
    id: 'transactions-3',
    title: 'Editando e excluindo transações',
    content: `Você pode editar ou excluir transações a qualquer momento.

**Para editar:**
1. Encontre a transação na lista
2. Clique na transação para abrir os detalhes
3. Clique em "Editar"
4. Faça as alterações necessárias
5. Salve as mudanças

**Para excluir:**
1. Abra os detalhes da transação
2. Clique em "Excluir"
3. Confirme a exclusão

**Atenção:** Ao excluir uma transação, o saldo da conta será recalculado automaticamente.`,
    category: 'transactions',
    tags: ['editar', 'excluir', 'modificar']
  },
  {
    id: 'transactions-4',
    title: 'Filtrando transações',
    content: `Use filtros para encontrar transações específicas rapidamente.

**Filtros disponíveis:**
- Período (data inicial e final)
- Conta
- Categoria
- Tipo (receita/despesa)
- Valor mínimo/máximo
- Descrição (busca por texto)

**Como usar:**
1. Na página de Transações, use os filtros no topo
2. Selecione os critérios desejados
3. Os resultados são atualizados automaticamente

**Dica:** Combine múltiplos filtros para encontrar exatamente o que procura!`,
    category: 'transactions',
    tags: ['filtros', 'buscar', 'pesquisar']
  },

  // Orçamentos
  {
    id: 'budgets-1',
    title: 'Criando seu primeiro orçamento',
    content: `Orçamentos ajudam você a planejar e controlar seus gastos mensais.

**Como criar:**
1. Vá até "Orçamentos" no menu
2. Selecione o mês e ano
3. Clique em "Novo Orçamento"
4. Escolha a categoria
5. Defina o valor planejado

**Dica:** Você pode criar orçamentos para múltiplas categorias no mesmo mês. O sistema mostra quanto você já gastou e quanto ainda pode gastar.`,
    category: 'budgets',
    tags: ['orçamento', 'criar', 'planejamento']
  },
  {
    id: 'budgets-2',
    title: 'Replicando orçamentos',
    content: `Economize tempo replicando orçamentos de um mês para outro.

**Opções de replicação:**
- Replicar um orçamento específico
- Replicar todos os orçamentos de uma categoria
- Replicar todos os orçamentos do mês

**Como replicar:**
1. Na página de Orçamentos
2. Use o botão "Replicar" no orçamento desejado
3. Escolha o mês de destino
4. Confirme a replicação

**Dica:** Ideal para manter orçamentos similares mês a mês!`,
    category: 'budgets',
    tags: ['replicar', 'copiar', 'duplicar']
  },
  {
    id: 'budgets-3',
    title: 'Entendendo projeções',
    content: `As projeções mostram como seus gastos evoluirão ao longo do tempo.

**O que são projeções?**
- Estimativas baseadas em seus gastos históricos
- Mostram tendências futuras
- Ajudam no planejamento financeiro

**Como funcionam:**
- O sistema analisa suas transações passadas
- Calcula médias e tendências
- Projeta valores futuros

**Dica:** Use as projeções para ajustar seus orçamentos e evitar surpresas!`,
    category: 'budgets',
    tags: ['projeções', 'previsão', 'tendências']
  },
  {
    id: 'budgets-4',
    title: 'Orçamento mínimo recomendado',
    content: `O sistema calcula automaticamente um orçamento mínimo recomendado para cada categoria.

**Como funciona:**
- Baseado nos seus gastos históricos
- Considera a média dos últimos meses
- Sugere um valor mínimo para manter seu padrão

**Como usar:**
1. Ao criar um orçamento, veja a sugestão de valor mínimo
2. Use como referência para definir seu orçamento
3. Ajuste conforme suas necessidades

**Dica:** O valor mínimo ajuda a evitar subestimar seus gastos!`,
    category: 'budgets',
    tags: ['mínimo', 'recomendação', 'sugestão']
  },

  // Metas e Objetivos
  {
    id: 'goals-1',
    title: 'Criando uma meta financeira',
    content: `Defina objetivos claros e acompanhe seu progresso.

**Como criar:**
1. Vá até "Objetivos" no menu
2. Clique em "Novo Objetivo"
3. Preencha:
   - Nome da meta
   - Valor objetivo
   - Data limite (opcional)
   - Descrição
   - Imagem (opcional)

**Tipos de metas comuns:**
- Reserva de emergência
- Viagem
- Compra de carro/casa
- Investimentos
- Quitar dívidas

**Dica:** Defina metas realistas e acompanhe regularmente!`,
    category: 'goals',
    tags: ['metas', 'objetivos', 'criar']
  },
  {
    id: 'goals-2',
    title: 'Contribuindo para suas metas',
    content: `Registre contribuições para acompanhar seu progresso.

**Como contribuir:**
1. Abra a meta desejada
2. Clique em "Adicionar Contribuição"
3. Informe o valor e a data
4. Escolha a conta de origem

**Acompanhamento:**
- Veja quanto já foi poupado
- Acompanhe o percentual concluído
- Veja quanto falta para alcançar a meta

**Dica:** Contribua regularmente, mesmo que seja um valor pequeno!`,
    category: 'goals',
    tags: ['contribuir', 'poupar', 'progresso']
  },
  {
    id: 'goals-3',
    title: 'Reserva de Emergência',
    content: `A reserva de emergência é fundamental para sua segurança financeira.

**O que é?**
- Valor guardado para imprevistos
- Recomendado: 6 meses de renda
- Deve estar em aplicação de fácil acesso

**Como funciona no c2Finance:**
- Meta criada automaticamente quando você informa sua renda mensal
- Valor calculado: 6x sua renda mensal
- Acompanhe seu progresso na página de Objetivos

**Dica:** Priorize sua reserva de emergência antes de outros objetivos!`,
    category: 'goals',
    tags: ['reserva', 'emergência', 'segurança']
  },

  // Dívidas e Investimentos
  {
    id: 'debts-investments-1',
    title: 'Registrando uma dívida',
    content: `Controle suas dívidas e acompanhe o progresso do pagamento.

**Como registrar:**
1. Vá até "Dívidas" no menu
2. Clique em "Nova Dívida"
3. Preencha:
   - Nome da dívida
   - Valor principal
   - Valor total (com juros)
   - Taxa de juros mensal
   - Tipo de juros (simples ou composto)
   - Data de vencimento
   - Prioridade

**Acompanhamento:**
- Veja quanto já foi pago
- Acompanhe o saldo devedor
- Veja projeções de pagamento

**Dica:** Priorize dívidas com maior taxa de juros!`,
    category: 'debts-investments',
    tags: ['dívidas', 'registrar', 'controle']
  },
  {
    id: 'debts-investments-2',
    title: 'Registrando investimentos',
    content: `Mantenha controle sobre seus investimentos.

**Como registrar:**
1. Vá até "Investimentos" no menu
2. Clique em "Novo Investimento"
3. Preencha:
   - Nome do investimento
   - Tipo (ações, fundos, tesouro, etc)
   - Valor investido
   - Data de aplicação
   - Rentabilidade esperada

**Acompanhamento:**
- Veja o valor total investido
- Acompanhe a evolução
- Veja projeções de retorno

**Dica:** Revise seus investimentos regularmente!`,
    category: 'debts-investments',
    tags: ['investimentos', 'registrar', 'acompanhar']
  },
  {
    id: 'debts-investments-3',
    title: 'Atualizando valores de investimentos',
    content: `Mantenha seus investimentos atualizados com os valores de mercado.

**Como atualizar:**
1. Abra o investimento desejado
2. Clique em "Atualizar Valor"
3. Informe o novo valor de mercado
4. A data da atualização é registrada automaticamente

**Histórico:**
- Todas as atualizações são registradas
- Veja a evolução do investimento ao longo do tempo
- Acompanhe ganhos e perdas

**Dica:** Atualize regularmente para ter uma visão precisa do seu patrimônio!`,
    category: 'debts-investments',
    tags: ['atualizar', 'valorização', 'patrimônio']
  },

  // Relatórios
  {
    id: 'reports-1',
    title: 'Gerando relatórios',
    content: `Visualize seus dados financeiros de forma clara e objetiva.

**Tipos de relatórios:**
- Fluxo de caixa
- Gastos por categoria
- Receitas vs Despesas
- Evolução patrimonial

**Como gerar:**
1. Vá até "Relatórios" no menu
2. Selecione o período desejado
3. Escolha o tipo de relatório
4. Visualize os gráficos e dados

**Exportação:**
- Exporte relatórios em PDF
- Compartilhe com seu contador ou consultor

**Dica:** Use relatórios para identificar padrões e oportunidades de economia!`,
    category: 'reports',
    tags: ['relatórios', 'gráficos', 'análise']
  },
  {
    id: 'reports-2',
    title: 'Entendendo o fluxo de caixa',
    content: `O fluxo de caixa mostra suas entradas e saídas ao longo do tempo.

**O que você vê:**
- Receitas do período
- Despesas do período
- Saldo final
- Tendências

**Como usar:**
- Identifique meses com saldo negativo
- Veja quando você tem mais receitas
- Planeje melhor seus gastos

**Dica:** Mantenha um fluxo de caixa positivo para sua saúde financeira!`,
    category: 'reports',
    tags: ['fluxo de caixa', 'entradas', 'saídas']
  },

  // Integrações
  {
    id: 'integrations-1',
    title: 'Conectando sua conta bancária',
    content: `Conecte suas contas bancárias para sincronização automática (Plano Premium).

**Como conectar:**
1. Vá até "Integrações" no menu
2. Clique em "Conectar Banco"
3. Escolha sua instituição financeira
4. Autorize a conexão
5. Aguarde a sincronização

**Benefícios:**
- Transações sincronizadas automaticamente
- Menos trabalho manual
- Dados sempre atualizados

**Importante:** A conexão é segura e você pode desconectar a qualquer momento.`,
    category: 'integrations',
    tags: ['banco', 'conectar', 'sincronização']
  },
  {
    id: 'integrations-2',
    title: 'Importação manual de extratos',
    content: `Importe extratos mesmo sem conexão bancária.

**Formatos suportados:**
- CSV (Excel, Google Sheets)
- OFX (formato bancário padrão)

**Como importar:**
1. Exporte o extrato do seu banco
2. Vá até "Transações" > "Importar"
3. Selecione o arquivo
4. Revise os dados
5. Confirme a importação

**Dica:** A maioria dos bancos permite exportar extratos em CSV ou OFX.`,
    category: 'integrations',
    tags: ['importar', 'extrato', 'csv', 'ofx']
  },

  // AI Advisor
  {
    id: 'advisor-1',
    title: 'Como usar o AI Advisor',
    content: `O AI Advisor é seu consultor financeiro pessoal com inteligência artificial.

**O que ele faz:**
- Analisa seus dados financeiros
- Fornece insights personalizados
- Sugere ações práticas
- Responde suas perguntas

**Como usar:**
1. Clique no botão "Advisor I.A" no header
2. Faça uma pergunta ou peça uma análise
3. Receba recomendações personalizadas

**Exemplos de perguntas:**
- "Como posso economizar mais?"
- "Estou gastando muito em alimentação?"
- "Qual dívida devo priorizar?"

**Dica:** Quanto mais dados você tiver, melhores serão as recomendações!`,
    category: 'advisor',
    tags: ['advisor', 'ia', 'consultor', 'insights']
  },
  {
    id: 'advisor-2',
    title: 'Limites do AI Advisor',
    content: `O uso do AI Advisor tem limites conforme seu plano.

**Limites por plano:**
- **Gratuito:** Não disponível
- **Pro:** 10 consultas por mês
- **Premium:** 100 consultas por mês

**O que conta como consulta:**
- Cada pergunta feita ao advisor
- Cada análise solicitada
- Cada insight gerado

**Como verificar:**
- Veja quantas consultas você já usou no mês
- O contador é resetado no início de cada mês

**Dica:** Use suas consultas com sabedoria para obter o máximo valor!`,
    category: 'advisor',
    tags: ['limites', 'consultas', 'planos']
  },
  {
    id: 'advisor-3',
    title: 'Dicas diárias do Advisor',
    content: `Receba uma dica personalizada todos os dias no seu dashboard.

**Como funciona:**
- Dica gerada automaticamente todos os dias
- Baseada nos seus dados financeiros
- Personalizada para sua situação

**Onde encontrar:**
- No dashboard principal
- Card "Dica do Dia"

**Dica:** Leia a dica diária para manter-se focado em seus objetivos financeiros!`,
    category: 'advisor',
    tags: ['dicas', 'diárias', 'dashboard']
  },

  // Conta e Assinatura
  {
    id: 'account-1',
    title: 'Gerenciando sua assinatura',
    content: `Gerencie seu plano e assinatura facilmente.

**O que você pode fazer:**
- Ver seu plano atual
- Fazer upgrade para Pro ou Premium
- Gerenciar pagamentos
- Cancelar assinatura

**Como acessar:**
1. Vá até "Configurações"
2. Veja a seção "Assinatura"
3. Use os botões para gerenciar

**Planos disponíveis:**
- **Gratuito:** Funcionalidades básicas
- **Pro:** R$ 29/mês - IA e recursos avançados
- **Premium:** R$ 79/mês - IA ilimitada e integrações

**Dica:** Você pode cancelar a qualquer momento sem multa!`,
    category: 'account',
    tags: ['assinatura', 'plano', 'cobrança']
  },
  {
    id: 'account-2',
    title: 'Atualizando seu perfil',
    content: `Mantenha suas informações atualizadas.

**Informações que você pode atualizar:**
- Nome completo
- Foto de perfil
- Localização (estado e cidade)
- Data de nascimento
- Gênero
- Renda mensal média

**Como atualizar:**
1. Vá até "Configurações"
2. Edite os campos desejados
3. Clique em "Salvar Alterações"

**Importante:** A renda mensal é usada para calcular sua reserva de emergência automaticamente.`,
    category: 'account',
    tags: ['perfil', 'atualizar', 'informações']
  },
  {
    id: 'account-3',
    title: 'Exportando seus dados',
    content: `Exporte seus dados financeiros quando precisar.

**O que pode ser exportado:**
- Todas as transações
- Orçamentos
- Metas e objetivos
- Dívidas e investimentos

**Como exportar:**
1. Vá até "Configurações"
2. Na seção "Zona de Perigo"
3. Clique em "Exportar Dados"
4. Aguarde o processamento
5. Baixe o arquivo

**Formato:** Os dados são exportados em formato estruturado (JSON/CSV).

**Dica:** Exporte regularmente para manter um backup dos seus dados!`,
    category: 'account',
    tags: ['exportar', 'dados', 'backup']
  },
  {
    id: 'account-4',
    title: 'Compartilhando acesso à conta',
    content: `Compartilhe acesso à sua conta com familiares ou contadores.

**Como compartilhar:**
1. Vá até "Configurações" > "Compartilhamento"
2. Adicione o email da pessoa
3. Escolha o nível de acesso:
   - **Visualização:** Apenas visualizar dados
   - **Edição:** Visualizar e editar dados

**Controle:**
- Veja quem tem acesso
- Revogue acesso a qualquer momento
- Gerencie permissões

**Dica:** Ideal para casais ou para compartilhar com seu contador!`,
    category: 'account',
    tags: ['compartilhar', 'acesso', 'permissões']
  }
];

export function searchArticles(query: string): HelpArticle[] {
  if (!query.trim()) return helpArticles;
  
  const lowerQuery = query.toLowerCase();
  return helpArticles.filter(article => 
    article.title.toLowerCase().includes(lowerQuery) ||
    article.content.toLowerCase().includes(lowerQuery) ||
    article.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getArticlesByCategory(categoryId: string): HelpArticle[] {
  return helpArticles.filter(article => article.category === categoryId);
}

export function getCategoryById(categoryId: string): HelpCategory | undefined {
  return helpCategories.find(cat => cat.id === categoryId);
}
