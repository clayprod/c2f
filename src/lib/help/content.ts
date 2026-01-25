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
    id: 'dashboard',
    name: 'Dashboard',
    icon: 'bx-home',
    description: 'Visão geral e recursos do painel principal'
  },
  {
    id: 'transactions',
    name: 'Transações',
    icon: 'bx-swap-horizontal',
    description: 'Adicionar, editar, importar e gerenciar transações'
  },
  {
    id: 'budgets',
    name: 'Orçamentos',
    icon: 'bx-wallet-alt',
    description: 'Criar e gerenciar orçamentos e projeções'
  },
  {
    id: 'credit-cards',
    name: 'Cartões de Crédito',
    icon: 'bx-credit-card',
    description: 'Gerenciar cartões, faturas e pagamentos'
  },
  {
    id: 'goals',
    name: 'Metas e Objetivos',
    icon: 'bx-bullseye',
    description: 'Criar metas e acompanhar seu progresso'
  },
  {
    id: 'debts',
    name: 'Dívidas',
    icon: 'bx-trending-down',
    description: 'Controlar dívidas e negociações'
  },
  {
    id: 'receivables',
    name: 'Contas a Receber',
    icon: 'bx-money',
    description: 'Rastrear dinheiro que te devem'
  },
  {
    id: 'investments',
    name: 'Investimentos',
    icon: 'bx-trending-up',
    description: 'Gerenciar investimentos e aportes'
  },
  {
    id: 'assets',
    name: 'Patrimônio',
    icon: 'bx-building-house',
    description: 'Rastrear patrimônio e evolução'
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
    description: 'Conectar bancos, WhatsApp e importar dados'
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
    description: 'Perfil, planos, notificações e cobrança'
  }
];

export const helpArticles: HelpArticle[] = [
  // ========================
  // Começando
  // ========================
  {
    id: 'getting-started-1',
    title: 'Bem-vindo ao c2Finance',
    content: `O c2Finance é uma plataforma completa para gerenciar suas finanças pessoais com o poder da inteligência artificial.

**O que você pode fazer:**
- Registrar todas as suas transações financeiras
- Criar orçamentos e acompanhar seus gastos
- Gerenciar cartões de crédito e faturas
- Definir metas financeiras e objetivos
- Controlar dívidas e contas a receber
- Gerenciar investimentos e patrimônio
- Receber insights e recomendações do AI Advisor
- Gerar relatórios detalhados
- Integrar com WhatsApp para facilitar o registro

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

  // ========================
  // Dashboard
  // ========================
  {
    id: 'dashboard-1',
    title: 'Visão geral do Dashboard',
    content: `O Dashboard é sua central de comando financeiro, mostrando uma visão completa das suas finanças.

**O que você encontra:**
- **Saldo Total:** Soma de todas as suas contas
- **Saldo Projetado:** Previsão do saldo considerando transações futuras
- **Receitas do Mês:** Total de entradas no período
- **Despesas do Mês:** Total de saídas no período
- **Economia:** Diferença entre receitas e despesas

**Cards disponíveis:**
- Gráfico de fluxo de caixa (mensal, trimestral ou anual)
- Despesas por categoria
- Orçamentos por categoria
- Transações recentes
- Dica do dia do AI Advisor

**Dica:** Use os filtros de período para visualizar diferentes intervalos de tempo!`,
    category: 'dashboard',
    tags: ['dashboard', 'painel', 'visão geral', 'saldo']
  },
  {
    id: 'dashboard-2',
    title: 'Gráfico de Fluxo de Caixa',
    content: `O gráfico de fluxo de caixa mostra a evolução das suas finanças ao longo do tempo.

**O que o gráfico mostra:**
- **Linha de Receitas:** Suas entradas por período
- **Linha de Despesas:** Suas saídas por período
- **Área de Saldo:** Diferença entre receitas e despesas

**Períodos disponíveis:**
- **Mensal:** Últimos 12 meses
- **Trimestral:** Últimos 4 trimestres
- **Anual:** Últimos anos

**Como interpretar:**
- Quando a linha verde está acima da vermelha, você está economizando
- Quando está abaixo, está gastando mais do que ganha
- Use para identificar padrões sazonais nos seus gastos

**Dica:** Passe o mouse sobre os pontos para ver os valores exatos!`,
    category: 'dashboard',
    tags: ['gráfico', 'fluxo de caixa', 'receitas', 'despesas']
  },

  // ========================
  // Transações
  // ========================
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
  {
    id: 'transactions-5',
    title: 'Transações recorrentes',
    content: `Configure transações que se repetem automaticamente para economizar tempo.

**O que são transações recorrentes:**
- Gastos ou receitas que acontecem regularmente
- Exemplos: salário, aluguel, assinaturas, contas fixas

**Frequências disponíveis:**
- Diária
- Semanal
- Quinzenal
- Mensal
- Trimestral
- Anual

**Como criar:**
1. Ao adicionar uma transação, marque "Transação Recorrente"
2. Escolha a frequência
3. O sistema gera automaticamente as próximas ocorrências

**Benefícios:**
- Orçamentos automáticos são gerados para categorias com recorrentes
- Projeções mais precisas do fluxo de caixa
- Menos trabalho manual

**Dica:** Use para todas as suas contas fixas mensais!`,
    category: 'transactions',
    tags: ['recorrentes', 'automático', 'frequência', 'fixas']
  },
  {
    id: 'transactions-6',
    title: 'Transações parceladas',
    content: `Registre compras parceladas e acompanhe as parcelas restantes.

**Como criar transação parcelada:**
1. Ao adicionar uma transação, marque "Parcelado"
2. Informe o número de parcelas
3. O sistema divide automaticamente o valor
4. Cada parcela é registrada no mês correspondente

**Acompanhamento:**
- Veja quantas parcelas já foram pagas
- Acompanhe as parcelas futuras
- Total já pago vs total restante

**Impacto nos orçamentos:**
- As parcelas são consideradas nos orçamentos de cada mês
- Projeções incluem parcelas futuras automaticamente

**Dica:** Ideal para compras grandes no cartão de crédito!`,
    category: 'transactions',
    tags: ['parcelado', 'parcelas', 'dividido']
  },
  {
    id: 'transactions-7',
    title: 'Categorização automática com IA',
    content: `O c2Finance usa inteligência artificial para categorizar suas transações automaticamente.

**Como funciona:**
- Ao importar transações, a IA analisa a descrição
- Sugere a categoria mais provável
- Você pode aceitar ou alterar a sugestão

**Aprendizado contínuo:**
- A IA aprende com suas correções
- Quanto mais você usa, mais precisa fica
- Suas preferências são respeitadas

**Onde usar:**
- Na importação de extratos CSV/OFX
- Na sincronização automática de bancos
- Na edição manual de transações

**Dica:** Corrija as categorias erradas para melhorar a precisão da IA ao longo do tempo!`,
    category: 'transactions',
    tags: ['ia', 'categorização', 'automático', 'inteligência artificial']
  },

  // ========================
  // Orçamentos
  // ========================
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

**O que você vê:**
- Valor planejado
- Valor gasto até agora
- Percentual utilizado
- Quanto ainda pode gastar

**Dica:** Você pode criar orçamentos para múltiplas categorias no mesmo mês.`,
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

**Fontes das projeções:**
- Transações recorrentes
- Transações parceladas
- Faturas de cartão de crédito
- Aportes para objetivos
- Pagamentos de dívidas
- Aportes em investimentos

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

**Validação automática:**
- O sistema impede reduzir o orçamento abaixo do mínimo
- Mostra quais fontes compõem o mínimo
- Sugere ações para reduzir (ex: desmarcar recorrentes)

**Dica:** O valor mínimo ajuda a evitar subestimar seus gastos!`,
    category: 'budgets',
    tags: ['mínimo', 'recomendação', 'sugestão', 'validação']
  },
  {
    id: 'budgets-5',
    title: 'Orçamentos automáticos',
    content: `O sistema gera orçamentos automaticamente para algumas categorias especiais.

**Fontes de orçamentos automáticos:**
- **Cartões de Crédito:** Gerados a partir das faturas
- **Objetivos:** Aportes mensais conforme frequência configurada
- **Dívidas Negociadas:** Parcelas distribuídas nos meses
- **Investimentos:** Aportes conforme frequência configurada

**Identificação:**
- Badge "Automático" aparece no orçamento
- Edição manual é bloqueada
- Ajustes devem ser feitos na fonte (cartão, objetivo, etc.)

**Benefícios:**
- Menos trabalho manual
- Orçamentos sempre atualizados
- Projeções mais precisas

**Dica:** Para ajustar um orçamento automático, edite a fonte correspondente!`,
    category: 'budgets',
    tags: ['automático', 'gerado', 'cartão', 'objetivo', 'dívida']
  },
  {
    id: 'budgets-6',
    title: 'Validação de valor mínimo',
    content: `O sistema valida automaticamente se seu orçamento cobre os compromissos assumidos.

**O que é considerado:**
- Transações recorrentes da categoria
- Aportes para objetivos
- Parcelas de dívidas
- Aportes em investimentos
- Faturas de cartão de crédito

**Quando aparece o erro:**
- Ao tentar reduzir o orçamento abaixo do mínimo
- O sistema lista todas as fontes que impedem a redução

**Como resolver:**
- Aumentar o valor do orçamento
- Desmarcar transações como recorrentes
- Ajustar frequência de aportes em objetivos/investimentos
- Renegociar parcelas de dívidas

**Dica:** Essa validação garante que você não subestime seus gastos obrigatórios!`,
    category: 'budgets',
    tags: ['validação', 'mínimo', 'erro', 'compromissos']
  },

  // ========================
  // Cartões de Crédito
  // ========================
  {
    id: 'credit-cards-1',
    title: 'Gerenciando cartões de crédito',
    content: `Controle seus cartões de crédito e nunca perca uma fatura.

**Como adicionar um cartão:**
1. Vá até "Cartões de Crédito" no menu
2. Clique em "Novo Cartão"
3. Preencha:
   - Nome do cartão
   - Últimos 4 dígitos
   - Bandeira
   - Limite de crédito
   - Dia de vencimento da fatura
   - Dia de fechamento

**O que você acompanha:**
- Limite disponível
- Fatura atual
- Próximo vencimento
- Histórico de faturas

**Dica:** Configure todos os seus cartões para ter uma visão completa!`,
    category: 'credit-cards',
    tags: ['cartão', 'crédito', 'adicionar', 'gerenciar']
  },
  {
    id: 'credit-cards-2',
    title: 'Faturas e pagamentos',
    content: `Acompanhe suas faturas e registre os pagamentos.

**Visualizando faturas:**
- Veja o total de cada fatura
- Detalhamento de todas as transações
- Data de vencimento
- Status (aberta, fechada, paga)

**Registrando pagamento:**
1. Abra a fatura desejada
2. Clique em "Registrar Pagamento"
3. Informe o valor pago
4. Escolha a conta de origem
5. Confirme

**Pagamento parcial:**
- Você pode pagar menos que o total
- O saldo restante é mostrado
- Ideal para acompanhar parcelamentos do próprio cartão

**Dica:** Sempre pague a fatura integral para evitar juros!`,
    category: 'credit-cards',
    tags: ['fatura', 'pagamento', 'vencimento']
  },
  {
    id: 'credit-cards-3',
    title: 'Orçamentos automáticos de cartões',
    content: `Os orçamentos de cartões de crédito são gerados automaticamente.

**Como funciona:**
- O sistema cria orçamentos baseados nas suas faturas
- Transações do cartão são agrupadas por categoria
- Projeções incluem parcelas futuras

**Por que é automático:**
- Evita duplicação (transação + orçamento manual)
- Valores sempre atualizados com a fatura
- Projeções mais precisas

**Importante:**
- Você não pode criar orçamentos manuais para categorias de cartão
- Ajuste os gastos diretamente nas transações do cartão
- O limite do cartão não afeta os orçamentos

**Dica:** Use os relatórios para ver quanto gasta em cada categoria do cartão!`,
    category: 'credit-cards',
    tags: ['orçamento', 'automático', 'fatura', 'categoria']
  },

  // ========================
  // Metas e Objetivos
  // ========================
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
   - Incluir no orçamento (sim/não)
   - Frequência de aportes

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
  {
    id: 'goals-4',
    title: 'Incluindo metas no orçamento',
    content: `Configure suas metas para gerar orçamentos automaticamente.

**O que é "Incluir no Orçamento":**
- Quando ativado, o sistema gera orçamentos automáticos para os aportes
- Ajuda a planejar quanto reservar por mês

**Frequências disponíveis:**
- Diária
- Semanal
- Quinzenal
- Mensal
- Trimestral
- Anual

**Cálculo automático:**
- Se você definir data limite e não informar valor de aporte
- O sistema calcula automaticamente quanto guardar por mês
- Baseado no valor restante e tempo disponível

**Benefícios:**
- Orçamentos automáticos para a categoria do objetivo
- Projeções de fluxo de caixa incluem os aportes
- Validação de mínimo considera os aportes

**Dica:** Use a frequência mensal para uma poupança regular e consistente!`,
    category: 'goals',
    tags: ['orçamento', 'automático', 'frequência', 'aporte']
  },

  // ========================
  // Dívidas
  // ========================
  {
    id: 'debts-1',
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
    category: 'debts',
    tags: ['dívidas', 'registrar', 'controle']
  },
  {
    id: 'debts-2',
    title: 'Status de negociação',
    content: `Acompanhe o status de cada dívida no processo de negociação.

**Status disponíveis:**
- **Ativa:** Dívida em aberto, sendo paga normalmente
- **Negociando:** Em processo de negociação com o credor
- **Negociada:** Acordo fechado com novas condições
- **Paga:** Dívida quitada
- **Vencida:** Dívida em atraso

**Filtros por status:**
- Use os filtros para ver dívidas por situação
- Priorize as vencidas e em negociação

**Dica:** Negocie suas dívidas para conseguir melhores condições!`,
    category: 'debts',
    tags: ['negociação', 'status', 'acordo']
  },
  {
    id: 'debts-3',
    title: 'Dívidas negociadas e orçamentos',
    content: `Dívidas negociadas podem gerar orçamentos automaticamente.

**O que é uma dívida negociada:**
- Acordo fechado com o credor
- Novas condições de pagamento
- Parcelas definidas

**Configuração:**
1. Marque a dívida como "Negociada"
2. Ative "Incluir no Orçamento"
3. Defina:
   - Número de parcelas
   - Dia de vencimento das parcelas
   - Ou use frequência de aportes

**Orçamentos automáticos:**
- O sistema gera orçamentos para cada parcela
- Distribui nos meses corretos
- Facilita o planejamento

**Dica:** Configure todas as dívidas negociadas para ter uma visão completa dos compromissos!`,
    category: 'debts',
    tags: ['negociada', 'orçamento', 'parcelas', 'automático']
  },
  {
    id: 'debts-4',
    title: 'Registrando pagamentos de dívidas',
    content: `Acompanhe os pagamentos das suas dívidas.

**Como registrar pagamento:**
1. Abra a dívida desejada
2. Clique em "Registrar Pagamento"
3. Informe o valor pago
4. Escolha a conta de origem
5. Confirme

**O que acontece:**
- O saldo devedor é atualizado
- A transação é registrada automaticamente
- O progresso de pagamento é atualizado

**Pagamento parcial:**
- Você pode pagar qualquer valor
- O saldo restante é recalculado

**Dica:** Pague mais que o mínimo sempre que possível para quitar antes!`,
    category: 'debts',
    tags: ['pagamento', 'quitar', 'parcela']
  },

  // ========================
  // Contas a Receber
  // ========================
  {
    id: 'receivables-1',
    title: 'O que são contas a receber',
    content: `Controle o dinheiro que outras pessoas ou empresas te devem.

**Exemplos de contas a receber:**
- Empréstimo feito para um amigo
- Venda parcelada
- Serviço prestado aguardando pagamento
- Reembolso de despesas

**Por que controlar:**
- Não esquecer de cobrar
- Acompanhar quem deve quanto
- Ver o total a receber
- Planejar fluxo de caixa

**Dica:** Registre todas as contas a receber para ter controle total do seu dinheiro!`,
    category: 'receivables',
    tags: ['receber', 'devem', 'cobrança']
  },
  {
    id: 'receivables-2',
    title: 'Registrando contas a receber',
    content: `Registre valores que você tem a receber.

**Como registrar:**
1. Vá até "Contas a Receber" no menu
2. Clique em "Nova Conta a Receber"
3. Preencha:
   - Nome/Descrição
   - Valor total
   - Nome do devedor
   - Data de vencimento
   - Prioridade
   - Notas (opcional)

**Status disponíveis:**
- **Pendente:** Aguardando pagamento
- **Parcial:** Parte foi recebida
- **Recebido:** Valor total recebido
- **Atrasado:** Passou da data de vencimento

**Dica:** Defina prioridade alta para valores maiores ou mais urgentes!`,
    category: 'receivables',
    tags: ['registrar', 'adicionar', 'criar']
  },
  {
    id: 'receivables-3',
    title: 'Recebendo pagamentos',
    content: `Registre quando receber pagamentos das contas a receber.

**Como registrar recebimento:**
1. Abra a conta a receber
2. Clique em "Registrar Recebimento"
3. Informe o valor recebido
4. Escolha a conta de destino
5. Confirme

**Recebimento parcial:**
- Você pode receber menos que o total
- O saldo pendente é atualizado
- O status muda para "Parcial"

**Transação automática:**
- Ao confirmar, uma transação de receita é criada
- Vinculada à conta a receber

**Dica:** Mantenha um controle rigoroso para não perder dinheiro!`,
    category: 'receivables',
    tags: ['receber', 'pagamento', 'cobrança']
  },

  // ========================
  // Investimentos
  // ========================
  {
    id: 'investments-1',
    title: 'Registrando investimentos',
    content: `Mantenha controle sobre seus investimentos.

**Como registrar:**
1. Vá até "Investimentos" no menu
2. Clique em "Novo Investimento"
3. Preencha:
   - Nome do investimento
   - Tipo (ações, fundos, tesouro, CDB, etc.)
   - Valor investido inicial
   - Data de aplicação
   - Rentabilidade esperada (opcional)
   - Incluir no orçamento (sim/não)
   - Frequência de aportes

**Acompanhamento:**
- Veja o valor total investido
- Acompanhe a evolução
- Compare com a rentabilidade esperada

**Dica:** Diversifique seus investimentos para reduzir riscos!`,
    category: 'investments',
    tags: ['investimentos', 'registrar', 'acompanhar']
  },
  {
    id: 'investments-2',
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
    category: 'investments',
    tags: ['atualizar', 'valorização', 'patrimônio']
  },
  {
    id: 'investments-3',
    title: 'Transações de investimentos',
    content: `Registre aportes e resgates dos seus investimentos.

**Tipos de transações:**
- **Aporte:** Novo valor investido
- **Resgate/Venda:** Retirada de valores
- **Rendimento:** Ganhos creditados

**Como registrar aporte:**
1. Abra o investimento
2. Clique em "Novo Aporte"
3. Informe valor, data e conta de origem

**Como registrar venda/resgate:**
1. Abra o investimento
2. Clique em "Vender/Resgatar"
3. Informe valor e conta de destino
4. Uma transação de receita é criada automaticamente

**Dica:** Acompanhe todos os aportes para ver o total investido vs. valor atual!`,
    category: 'investments',
    tags: ['aporte', 'resgate', 'venda', 'transação']
  },
  {
    id: 'investments-4',
    title: 'Incluindo investimentos no orçamento',
    content: `Configure seus investimentos para gerar orçamentos automáticos de aportes.

**Como funciona:**
1. Ative "Incluir no Orçamento" no investimento
2. Defina o valor do aporte mensal
3. Escolha a frequência

**Frequências disponíveis:**
- Diária
- Semanal
- Quinzenal
- Mensal
- Trimestral
- Anual

**Benefícios:**
- Orçamentos automáticos para a categoria de investimentos
- Projeções incluem os aportes futuros
- Validação de mínimo considera os compromissos

**Importante:**
- Os valores são projeções, não afetam seu saldo atual
- Ajuste o valor do aporte no investimento, não no orçamento

**Dica:** Configure aportes mensais automáticos para criar o hábito de investir!`,
    category: 'investments',
    tags: ['orçamento', 'automático', 'aporte', 'frequência']
  },

  // ========================
  // Patrimônio
  // ========================
  {
    id: 'assets-1',
    title: 'Rastreando seu patrimônio',
    content: `Acompanhe a evolução do seu patrimônio líquido.

**O que é patrimônio:**
- Soma de todos os seus bens e direitos
- Menos suas dívidas e obrigações
- Resultado: patrimônio líquido

**Tipos de ativos:**
- Imóveis
- Veículos
- Investimentos (já incluídos automaticamente)
- Outros bens de valor

**Como adicionar:**
1. Vá até "Patrimônio" no menu
2. Clique em "Novo Ativo"
3. Preencha nome, tipo e valor atual

**Dica:** Atualize os valores periodicamente para ter uma visão precisa!`,
    category: 'assets',
    tags: ['patrimônio', 'bens', 'ativos', 'líquido']
  },
  {
    id: 'assets-2',
    title: 'Histórico de avaliações',
    content: `Acompanhe como seus bens mudam de valor ao longo do tempo.

**Como funciona:**
- Cada vez que você atualiza o valor de um ativo, o histórico é registrado
- Veja gráficos de evolução
- Compare valorização vs. desvalorização

**Por que é importante:**
- Imóveis podem valorizar ou desvalorizar
- Veículos geralmente desvalorizam
- Ajuda a tomar decisões de venda

**Como atualizar:**
1. Abra o ativo
2. Clique em "Atualizar Valor"
3. Informe o novo valor de mercado

**Dica:** Atualize ao menos uma vez por ano, ou quando houver mudança significativa!`,
    category: 'assets',
    tags: ['avaliação', 'histórico', 'valorização', 'evolução']
  },

  // ========================
  // Relatórios
  // ========================
  {
    id: 'reports-1',
    title: 'Gerando relatórios',
    content: `Visualize seus dados financeiros de forma clara e objetiva.

**Tipos de relatórios:**
- Fluxo de caixa
- Gastos por categoria
- Receitas vs Despesas
- Evolução patrimonial
- Progresso de metas
- Visão de dívidas
- Performance de investimentos
- Orçamento vs Realizado

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
  {
    id: 'reports-3',
    title: 'Relatório de orçamento vs realizado',
    content: `Compare o que você planejou com o que realmente gastou.

**O que o relatório mostra:**
- Valor orçado por categoria
- Valor gasto real
- Diferença (economia ou estouro)
- Percentual de utilização

**Cores indicativas:**
- **Verde:** Abaixo do orçamento
- **Amarelo:** Próximo do limite
- **Vermelho:** Acima do orçamento

**Como usar:**
- Identifique categorias problemáticas
- Ajuste orçamentos futuros
- Reconheça onde você está economizando

**Dica:** Revise este relatório mensalmente para ajustar seu planejamento!`,
    category: 'reports',
    tags: ['orçamento', 'realizado', 'comparação', 'análise']
  },

  // ========================
  // Integrações
  // ========================
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
  {
    id: 'integrations-3',
    title: 'Integração com WhatsApp',
    content: `Registre transações rapidamente pelo WhatsApp (Plano Pro ou Premium).

**Como funciona:**
1. Configure a integração em "Integrações" > "WhatsApp"
2. Adicione o número do bot aos seus contatos
3. Envie mensagens para registrar transações

**Comandos disponíveis:**
- Envie o valor e descrição para registrar uma transação
- Ex: "50 almoço" registra despesa de R$ 50 em Alimentação
- Ex: "+1000 salário" registra receita de R$ 1.000

**Categorização automática:**
- O bot usa IA para categorizar
- Você pode corrigir se necessário

**Benefícios:**
- Registre de qualquer lugar
- Mais rápido que abrir o app
- Nunca esqueça de registrar

**Dica:** Use o WhatsApp para registrar gastos imediatamente após fazer!`,
    category: 'integrations',
    tags: ['whatsapp', 'bot', 'mensagem', 'rápido']
  },

  // ========================
  // AI Advisor
  // ========================
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
- "Analise meu fluxo de caixa"

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

  // ========================
  // Conta e Assinatura
  // ========================
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
- **Gratuito:** Dashboard, Transações, Contas, Categorias, Cartões
- **Pro:** Tudo do Gratuito + Orçamentos, Dívidas, Investimentos, Metas, AI Advisor (10/mês), WhatsApp
- **Premium:** Tudo do Pro + Relatórios, AI Advisor (100/mês), Integrações bancárias

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
3. Escolha as permissões por módulo

**Níveis de permissão por módulo:**
- **Sem acesso:** Não pode ver este módulo
- **Visualização:** Apenas visualizar dados
- **Edição:** Visualizar e editar dados

**Módulos configuráveis:**
- Transações
- Orçamentos
- Cartões de Crédito
- Objetivos
- Dívidas
- Investimentos
- Relatórios

**Controle:**
- Veja quem tem acesso
- Revogue acesso a qualquer momento
- Altere permissões quando precisar

**Dica:** Ideal para casais gerenciarem finanças juntos ou para compartilhar com seu contador!`,
    category: 'account',
    tags: ['compartilhar', 'acesso', 'permissões', 'módulos']
  },
  {
    id: 'account-5',
    title: 'Notificações e alertas',
    content: `Configure notificações para não perder nenhum compromisso financeiro.

**Tipos de notificações:**
- Fatura de cartão próxima do vencimento
- Orçamento próximo do limite
- Meta atingida
- Dívida vencendo
- Dicas do AI Advisor

**Como configurar:**
1. Vá até "Configurações" > "Notificações"
2. Ative/desative cada tipo
3. Escolha como receber (app, email)

**Regras personalizadas:**
- Crie alertas para valores específicos
- Configure dias de antecedência

**Dica:** Mantenha as notificações de faturas ativadas para nunca atrasar!`,
    category: 'account',
    tags: ['notificações', 'alertas', 'avisos', 'configurar']
  },
  {
    id: 'account-6',
    title: 'Tema claro e escuro',
    content: `Personalize a aparência do c2Finance.

**Temas disponíveis:**
- **Claro:** Fundo branco, ideal para uso diurno
- **Escuro:** Fundo escuro, confortável para os olhos à noite
- **Sistema:** Segue a preferência do seu dispositivo

**Como alterar:**
1. Clique no ícone de sol/lua no header
2. Ou vá em "Configurações" > "Aparência"
3. Escolha o tema desejado

**Benefícios do tema escuro:**
- Menos cansaço visual à noite
- Economia de bateria em telas OLED
- Visual moderno

**Dica:** Use "Sistema" para alternar automaticamente entre dia e noite!`,
    category: 'account',
    tags: ['tema', 'escuro', 'claro', 'aparência', 'modo']
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
