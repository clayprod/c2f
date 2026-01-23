'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TopBanner from '@/components/landing/TopBanner';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function PublicPrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopBanner />
      <Navbar />
      <main>
        <div className="container mx-auto py-10 px-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Política de Privacidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">1. Informações Gerais</h2>
                <p className="text-gray-700">
                  A Tenryu Ltda, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 45.693.933/0001-40, com sede na Rua Antonio Cometti, 237, Quadra D Lote 17, Vereador Adilson Leitao Xavier - Bragança Paulista - SP, CEP: 12927-161, ("Tenryu", "nós", "nosso") opera a plataforma c2Finance ("Serviço", "plataforma"), uma solução de tecnologia para gestão financeira pessoal e empresarial.
                </p>
                <p className="text-gray-700 mt-2">
                  Esta Política de Privacidade explica como coletamos, usamos, armazenamos e protegemos suas informações pessoais ao utilizar nosso Serviço, em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018) e demais legislações aplicáveis.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">2. Dados Coletados</h2>
                <p className="text-gray-700 mb-2">
                  Coletamos diferentes tipos de informações para fornecer e melhorar nosso Serviço:
                </p>
                <h3 className="font-medium text-lg mt-2">2.1. Dados Fornecidos pelo Usuário</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Nome completo</li>
                  <li>Endereço de e-mail</li>
                  <li>Número de telefone</li>
                  <li>CPF ou CNPJ</li>
                  <li>Dados financeiros e transacionais inseridos na plataforma</li>
                  <li>Preferências de uso e configurações da conta</li>
                </ul>

                <h3 className="font-medium text-lg mt-2">2.2. Dados Coletados Automaticamente</h3>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Endereço IP</li>
                  <li>Data e hora do acesso</li>
                  <li>Dispositivo e navegador utilizados</li>
                  <li>Identificadores de sessão e logs de uso</li>
                  <li>Cookies e tecnologias similares</li>
                  <li>Localização aproximada</li>
                </ul>

                <h3 className="font-medium text-lg mt-2">2.3. Dados de Pagamento</h3>
                <p className="text-gray-700 mt-1">
                  Dados de pagamento e faturamento podem ser processados por provedores de pagamento terceirizados para viabilizar assinaturas e cobranças recorrentes. Não armazenamos dados completos de cartão em nossos servidores.
                </p>

                <h3 className="font-medium text-lg mt-2">2.4. Dados de Integração Bancária (Open Banking)</h3>
                <p className="text-gray-700 mt-1">
                  Quando o Usuário opta por integrar sua conta bancária ao Serviço, podemos acessar informações de contas, transações, saldos e outros dados financeiros por meio de tecnologia de Open Banking, sempre com autorização expressa do Usuário.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">3. Finalidades do Tratamento</h2>
                <p className="text-gray-700 mb-2">
                  Utilizamos suas informações pessoais para as seguintes finalidades:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Providenciar, operar e melhorar o Serviço</li>
                  <li>Personalizar a experiência do Usuário</li>
                  <li>Realizar análises financeiras, projeções e recomendações automatizadas</li>
                  <li>Viabilizar cobrança, faturamento e controle de assinaturas</li>
                  <li>Enviar comunicações operacionais e notificações</li>
                  <li>Cumprir obrigações legais e regulatórias</li>
                  <li>Prevenir fraudes e garantir segurança</li>
                  <li>Realizar marketing e promoções (com consentimento)</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">4. Base Legal para o Tratamento</h2>
                <p className="text-gray-700 mb-2">
                  O tratamento de dados pessoais é realizado com base nas seguintes bases legais:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Execução de contrato (art. 7º, inciso V, da LGPD)</li>
                  <li>Cumprimento de obrigação legal (art. 7º, inciso II, da LGPD)</li>
                  <li>Legítimo interesse da controladora (art. 7º, inciso IX, da LGPD)</li>
                  <li>Consentimento do titular (art. 7º, inciso I, da LGPD) quando aplicável</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">5. Compartilhamento de Dados</h2>
                <p className="text-gray-700 mb-2">
                  Podemos compartilhar suas informações pessoais com:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Instituições financeiras e participantes do ecossistema Open Banking, mediante sua autorização expressa</li>
                  <li>Provedores de infraestrutura, armazenamento e autenticação de dados</li>
                  <li>Provedores de pagamento e faturamento</li>
                  <li>Provedores de IA para geração de insights e recomendações</li>
                  <li>Entidades reguladoras e autoridades públicas, quando exigido por lei</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Não vendemos, comercializamos ou alugamos informações pessoais de identificação de nossos Usuários a terceiros.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">6. Transferência Internacional</h2>
                <p className="text-gray-700">
                  Seus dados pessoais podem ser processados em servidores localizados no Brasil e/ou no exterior, conforme necessário para a prestação do Serviço, sempre com medidas de segurança adequadas e em conformidade com a legislação aplicável.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">7. Segurança dos Dados</h2>
                <p className="text-gray-700">
                  Adotamos medidas técnicas e organizacionais adequadas para proteger suas informações pessoais contra acesso não autorizado, alteração, divulgação ou destruição. Utilizamos criptografia, firewalls e outros mecanismos de segurança para garantir a integridade e confidencialidade dos dados.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">8. Seus Direitos</h2>
                <p className="text-gray-700 mb-2">
                  Conforme a LGPD, você tem direito a:
                </p>
                <ul className="list-disc pl-6 text-gray-700 space-y-1">
                  <li>Confirmar a existência de tratamento de dados</li>
                  <li>Acessar seus dados pessoais</li>
                  <li>Corrigir dados incompletos, inexatos ou desatualizados</li>
                  <li>Eliminar dados desnecessários ou excessivos</li>
                  <li>Eliminar dados tratados com seu consentimento</li>
                  <li>Portabilidade de dados a outro fornecedor de serviço</li>
                  <li>Obter informações sobre compartilhamento de dados</li>
                  <li>Informar sobre revogação de consentimento</li>
                  <li>Reconsiderar decisões automatizadas</li>
                </ul>
                <p className="text-gray-700 mt-2">
                  Para exercer esses direitos, entre em contato conosco através do e-mail contato@c2finance.com.br.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">9. Consentimento</h2>
                <p className="text-gray-700">
                  Ao utilizar nosso Serviço, você manifesta consentimento livre, informado e inequívoco para o tratamento de seus dados pessoais conforme descrito nesta Política. Você pode revogar seu consentimento a qualquer momento, embora isso possa impactar sua capacidade de utilizar determinadas funcionalidades do Serviço.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">10. Armazenamento e Prazos</h2>
                <p className="text-gray-700">
                  Manteremos suas informações pessoais pelo tempo necessário para cumprir as finalidades para as quais foram coletadas, incluindo obrigações legais e regulatórias. Quando possível, anonimizamos ou eliminamos dados ao final do período de retenção.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">11. Cookies e Tecnologias Semelhantes</h2>
                <p className="text-gray-700">
                  Utilizamos cookies e tecnologias semelhantes para autenticar sessões, lembrar preferências e melhorar a experiência no Serviço. Você pode gerenciar cookies nas configurações do seu navegador, mas isso pode impactar algumas funcionalidades.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">12. Alterações na Política</h2>
                <p className="text-gray-700">
                  Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos os Usuários sobre alterações significativas por meio de notificação no Serviço ou por e-mail. O uso contínuo do Serviço após as alterações constitui aceitação da nova Política.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-2">13. Contato</h2>
                <p className="text-gray-700">
                  Para dúvidas, comentários ou solicitações relacionadas a esta Política de Privacidade, entre em contato conosco:
                </p>
                <p className="text-gray-700 mt-2">
                  E-mail: contato@c2finance.com.br<br />
                  Endereço: Rua Antonio Cometti, 237, Quadra D Lote 17, Vereador Adilson Leitao Xavier - Bragança Paulista - SP, CEP: 12927-161<br />
                  CNPJ: 45.693.933/0001-40
                </p>
              </div>

              <div className="pt-4">
                <p className="text-gray-700">Data de vigência: 23/01/2026</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
