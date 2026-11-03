import { useState } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { View } from 'react-native';
import {
  BarChart3,
  Camera,
  FileCode2,
  PenSquare,
  QrCode,
  ReceiptText,
  X,
} from 'lucide-react-native';
import {
  parseNfceQrCodeContent,
  parseNfceXmlContent,
} from '@/domain/receipts/nfce-parser';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatDateBR } from '@/utils/currency';
import {
  Amount,
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  InlineMessage,
  ListRow,
  radius,
  Screen,
  Section,
  SectionHeader,
  spacing,
  TextField,
} from '@/ui';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const receipts = useFinanceStore((s) => s.receipts);
  const setPendingReceiptDraft = useFinanceStore((s) => s.setPendingReceiptDraft);

  const handleProcessQrOrKey = (rawContent: string) => {
    setErrorMessage(null);
    try {
      const draft = parseNfceQrCodeContent(rawContent);
      setPendingReceiptDraft(draft);
      setIsCameraOpen(false);
      router.push('/receipts/review');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não foi possível validar o QR Code ou chave da NFC-e.',
      );
    }
  };

  const handleImportXmlFile = async () => {
    setErrorMessage(null);
    try {
      const pickResult = await DocumentPicker.getDocumentAsync({
        type: ['text/xml', 'application/xml', '*/*'],
        copyToCacheDirectory: true,
      });

      if (pickResult.canceled || !pickResult.assets?.[0]?.uri) {
        return;
      }

      const fileUri = pickResult.assets[0].uri;
      const xmlString = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const draft = parseNfceXmlContent(xmlString);
      setPendingReceiptDraft(draft);
      router.push('/receipts/review');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Erro ao ler o arquivo XML da nota fiscal.',
      );
    }
  };

  const handleStartAssistedManual = () => {
    setErrorMessage(null);
    setPendingReceiptDraft({
      accessKey: null,
      receiptNumber: null,
      series: '1',
      issuerUf: 'BA',
      merchantName: '',
      merchantTradeName: null,
      merchantCnpj: null,
      issuedAt: new Date().toISOString(),
      totalGrossAmount: 0,
      totalDiscountAmount: 0,
      totalPaidAmount: 0,
      sourceType: 'assisted_manual',
      qrCodeRawUrl: null,
      requiresAssistedReview: true,
      statusMessage:
        'Lançamento manual assistido de nota fiscal. Informe o estabelecimento e os produtos comprados.',
      items: [],
    });
    router.push('/receipts/review');
  };

  return (
    <Screen
      header={{
        title: 'Leitor de NFC-e (SEFAZ-BA)',
        subtitle:
          'Escaneie o QR Code, importe o arquivo XML oficial ou informe a chave de acesso de 44 dígitos.',
        showBack: true,
        right: (
          <Button
            label="Preços"
            icon={BarChart3}
            variant="secondary"
            size="sm"
            onPress={() => router.push('/receipts/price-comparison')}
          />
        ),
      }}
    >
      {errorMessage ? (
        <InlineMessage
          tone="danger"
          message={errorMessage}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {/* 1. Scanner por Câmera */}
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <AppText variant="heading">1. Ler QR Code com a Câmera</AppText>
          <Badge tone="brand" label="QR CODE 2.0" />
        </View>
        <AppText variant="caption" tone="secondary">
          Não contornamos CAPTCHAs da SEFAZ: caso o portal solicite verificação interativa,
          extraímos os metadados da chave de 44 dígitos para revisão assistida ou XML.
        </AppText>

        {isCameraOpen ? (
          <View
            style={{
              height: 260,
              borderRadius: radius.md,
              overflow: 'hidden',
              backgroundColor: '#000',
              gap: spacing.xs,
            }}
          >
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (data) {
                  handleProcessQrOrKey(data);
                }
              }}
            />
            <Button
              label="Fechar Câmera"
              icon={X}
              variant="danger"
              size="sm"
              fullWidth
              onPress={() => setIsCameraOpen(false)}
            />
          </View>
        ) : (
          <Button
            label="Abrir Câmera para Ler QR Code"
            icon={Camera}
            fullWidth
            onPress={async () => {
              if (!permission?.granted) {
                const res = await requestPermission();
                if (!res.granted) {
                  setErrorMessage(
                    'Permissão de câmera negada. Utilize a chave de acesso ou importe o XML.',
                  );
                  return;
                }
              }
              setIsCameraOpen(true);
            }}
          />
        )}
      </Card>

      {/* 2. Importar XML Fiscal ou Chave / URL */}
      <Section>
        <SectionHeader
          title="2. Importar XML Oficial ou Chave (44 dígitos)"
          description="Compatível com arquivos procNFe / NFe e URLs públicas da SEFAZ."
        />
        <Card style={{ gap: spacing.md }}>
          <Button
            label="Selecionar Arquivo XML da NFC-e / NF-e"
            icon={FileCode2}
            variant="secondary"
            fullWidth
            onPress={() => void handleImportXmlFile()}
          />

          <Divider />

          <TextField
            label="Ou cole a URL do QR Code / Chave de Acesso (44 dígitos)"
            icon={QrCode}
            placeholder="Ex.: http://nfe.sefaz.ba.gov.br/... ou 292610..."
            value={manualInput}
            onChangeText={setManualInput}
          />

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label="Validar Chave / QR"
              style={{ flex: 1 }}
              onPress={() => handleProcessQrOrKey(manualInput)}
            />
            <Button
              label="Nota Assistida"
              icon={PenSquare}
              variant="secondary"
              style={{ flex: 1 }}
              onPress={handleStartAssistedManual}
            />
          </View>
        </Card>
      </Section>

      {/* 3. Histórico de Notas Fiscais Importadas */}
      <Section>
        <SectionHeader
          title={`Notas Fiscais Importadas (${receipts.length})`}
          actionLabel={receipts.length > 0 ? 'Comparar preços' : undefined}
          onAction={() => router.push('/receipts/price-comparison')}
        />
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {receipts.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Nenhuma nota fiscal registrada ainda"
              description="Escaneie um QR Code ou importe um XML para construir seu histórico de preços de supermercado."
            />
          ) : (
            receipts.map((r, idx) => (
              <View key={r.id}>
                {idx > 0 ? <Divider /> : null}
                <ListRow
                  onPress={() => router.push(`/receipts/${r.id}`)}
                  showChevron
                  title={r.merchant_trade_name || r.merchant_name}
                  subtitle={`${formatDateBR(r.issued_at.slice(0, 10))} · UF: ${r.issuer_uf} · ${r.source_type}`}
                  trailing={<Amount value={r.total_paid_amount} tone="positive" />}
                />
              </View>
            ))
          )}
        </Card>
      </Section>
    </Screen>
  );
}
