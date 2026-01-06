'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TopBanner from '@/components/landing/TopBanner';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function PublicTermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBanner />
      <Navbar />
      <main>
        <div className="container mx-auto py-10 px-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Termos de Uso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">1. Informações Gerais</h2>
                <p className="text-gray-700">
                  O presente Termo de Uso ("Termos") é celebrado entre Tenryu Ltda, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 45.693.933/0001-40, com sede na Rua Antonio Cometti, 237, Quadra D Lote 17, Vereador Adilson Leitao Xavier - Bragança Paulista - SP, CEP: 12927-161, doravante denominada "Tenryu", e o usuário ("Usuário") do serviço c2Finance ("Serviço"), plataforma de gestão financeira pessoal e empresarial.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">2. Aceitação dos Termos</h2>
                <p className="text-gray-700">
                  Ao acessar e utilizar o Serviço, o Usuário declara que leu, compreendeu e aceita todos os termos e condições aqui estabelecidos. Caso não concorde com estes Termos, o Usuário deve se abster de utilizar o Serviço.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">3. Descrição do Serviço</h2>
                <p className="text-gray-700">
                  O c2Finance é uma plataforma de tecnologia que oferece serviços de gestão financeira pessoal e empresarial, incluindo mas não se limitando a: controle de despesas e receitas, elaboração de orçamentos, projeções financeiras, integração com instituições financeiras via Open Banking e consultoria financeira por meio de inteligência artificial.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">4. Cadastro e Acesso</h2>
                <p className="text-gray-700 mb-2">
                  Para utilizar o Serviço, o Usuário deve criar uma conta fornecendo informações verdadeiras, exatas e completas. O Usuário é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades que ocorrerem em sua conta.
                </p>
                <p className="text-gray-700">
                  A Tenryu se reserva o direito de suspender ou encerrar contas que violem estes Termos ou que sejam utilizadas de forma fraudulenta ou abusiva.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">5. Uso do Serviço</h2>
                <p className="text-gray-700 mb-2">
                  O Usuário concorda em utilizar o Serviço de forma lícita, de acordo com a legislação vigente e com estes Termos. É vedado:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Utilizar o Serviço para fins ilegais ou não autorizados</li>
                  <li>Violar direitos de terceiros</li>
                  <li>Transmitir ou armazenar conteúdo ilegal, difamatório ou que viole direitos autorais</li>
                  <li>Interferir no funcionamento do Serviço</li>
                  <li>Realizar atividades que possam comprometer a segurança dos dados</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">6. Dados Financeiros e Integração Bancária</h2>
                <p className="text-gray-700 mb-2">
                  O Serviço pode integrar-se com instituições financeiras para obter informações sobre contas, transações e outros dados financeiros do Usuário. Esta integração é realizada por meio de tecnologia de Open Banking, de acordo com as normas do Banco Central do Brasil.
                </p>
                <p className="text-gray-700">
                  O Usuário reconhece que a Tenryu atua apenas como intermediária tecnológica e não tem acesso direto às credenciais bancárias do Usuário. A segurança e confidencialidade das informações bancárias são de responsabilidade das instituições financeiras.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">7. Propriedade Intelectual</h2>
                <p className="text-gray-700">
                  Todos os direitos de propriedade intelectual sobre o Serviço, incluindo mas não se limitando a softwares, interfaces, marcas, logotipos, textos, gráficos, imagens e códigos, são de propriedade exclusiva da Tenryu ou de seus licenciadores.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">8. Limitação de Responsabilidade</h2>
                <p className="text-gray-700">
                  A Tenryu não se responsabiliza por decisões financeiras tomadas pelo Usuário com base nas informações ou recomendações fornecidas pelo Serviço. O Serviço é fornecido "como está", sem garantias de qualquer natureza. A Tenryu não será responsável por quaisquer danos diretos, indiretos, incidentais, especiais ou consequenciais decorrentes do uso do Serviço.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">9. Modificações nos Termos</h2>
                <p className="text-gray-700">
                  A Tenryu poderá modificar estes Termos a qualquer momento, mediante aviso prévio ao Usuário. O uso contínuo do Serviço após as modificações constitui aceitação dos novos Termos.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">10. Lei Aplicável e Foro</h2>
                <p className="text-gray-700">
                  Estes Termos são regidos pelas leis da República Federativa do Brasil. Para dirimir quaisquer dúvidas ou controvérsias decorrentes deste Termo, as partes elegem o foro da comarca de Bragança Paulista - SP, com renúncia expressa a qualquer outro.
                </p>
              </div>

              <div className="pt-4">
                <p className="text-gray-700">
                  Data de vigência: {typeof window !== 'undefined' ? new Date().toLocaleDateString('pt-BR') : '05/01/2026'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}