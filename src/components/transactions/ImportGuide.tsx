'use client';

interface ImportGuideProps {
  type: 'csv' | 'ofx';
}

export default function ImportGuide({ type }: ImportGuideProps) {
  if (type === 'csv') {
    return (
      <div className="space-y-4 text-sm">
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-3">
            <i className='bx bx-info-circle text-blue-500 text-xl mt-0.5'></i>
            <div>
              <h4 className="font-medium text-blue-500 mb-1">Formato do Arquivo CSV</h4>
              <p className="text-muted-foreground">
                O arquivo deve estar no formato CSV com separador ponto e vírgula (;).
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Colunas Esperadas:</h4>
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span><strong>ID</strong> - Identificador único</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span><strong>DESCRIÇÃO</strong> - Texto da transação</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span><strong>DATA</strong> - Número Excel ou YYYY-MM-DD</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span><strong>VALOR</strong> - Valor em reais</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span><strong>CONTA</strong> - Nome da conta</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span><strong>CATEGORIA</strong> - Nome da categoria</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span><strong>TIPO</strong> - E (entrada) ou D (despesa)</span>
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-muted/30 font-mono text-xs overflow-x-auto">
          <p className="text-muted-foreground mb-1"># Exemplo:</p>
          <p>ID;DESCRIÇÃO;DATA;VALOR;CONTA;CATEGORIA;TIPO</p>
          <p>5409;BARBEIRO;45878;50;C.C CLAYTON;BELEZA;D</p>
          <p>5406;SALÁRIO;45877;15557,07;CONTA PRINCIPAL;SALÁRIO;E</p>
        </div>

        <a
          href="/cashflow.csv"
          download="modelo-importacao.csv"
          className="inline-flex items-center gap-2 text-primary hover:underline"
        >
          <i className='bx bx-download'></i>
          Baixar arquivo modelo (cashflow.csv)
        </a>
      </div>
    );
  }

  // OFX Guide
  return (
    <div className="space-y-4 text-sm">
      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
        <div className="flex items-start gap-3">
          <i className='bx bx-bank text-green-500 text-xl mt-0.5'></i>
          <div>
            <h4 className="font-medium text-green-500 mb-1">Arquivo OFX</h4>
            <p className="text-muted-foreground">
              O formato OFX (Open Financial Exchange) é o padrão usado pelos bancos brasileiros
              para exportar extratos.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Como obter o arquivo OFX:</h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground pl-2">
          <li>Acesse o internet banking do seu banco</li>
          <li>Vá para a seção de extratos</li>
          <li>Selecione o período desejado</li>
          <li>Escolha o formato OFX para download</li>
          <li>Importe o arquivo aqui</li>
        </ol>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Bancos compatíveis:</h4>
        <div className="flex flex-wrap gap-2 text-muted-foreground">
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">Banco do Brasil</span>
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">Bradesco</span>
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">Itaú</span>
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">Santander</span>
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">Caixa</span>
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">Nubank</span>
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">Inter</span>
          <span className="px-2 py-1 rounded-full bg-muted/50 text-xs">C6 Bank</span>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <div className="flex items-start gap-2">
          <i className='bx bx-bulb text-yellow-500'></i>
          <p className="text-muted-foreground text-xs">
            <strong>Dica:</strong> As transações duplicadas são automaticamente ignoradas
            usando o ID único fornecido pelo banco.
          </p>
        </div>
      </div>
    </div>
  );
}
