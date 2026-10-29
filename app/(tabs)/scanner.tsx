import { useState } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  parseNfceQrCodeContent,
  parseNfceXmlContent,
} from '@/domain/receipts/nfce-parser';
import { useFinanceStore } from '@/features/finance/use-finance-store';
import { formatCurrencyBRL, formatDateBR } from '@/utils/currency';

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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>FASE 3 • NOTAS FISCAIS E PREÇOS</Text>
          <Text style={styles.title}>Leitor de NFC-e (Bahia / Nacional)</Text>
        </View>
        <Pressable
          style={styles.compareBtn}
          onPress={() => router.push('/receipts/price-comparison')}
        >
          <Text style={styles.compareBtnText}>Comparar Preços</Text>
        </Pressable>
      </View>

      <Text style={styles.subtitle}>
        Escaneie o QR Code da NFC-e com a câmera, importe o arquivo XML oficial ou
        utilize a chave de acesso de 44 dígitos. Não contornamos CAPTCHAs da SEFAZ: caso
        o portal solicite desafio interativo, você poderá revisar ou importar o XML.
      </Text>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* 1. Scanner por Câmera */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Ler QR Code com a Câmera</Text>
        {isCameraOpen ? (
          <View style={styles.cameraWrapper}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (data) {
                  handleProcessQrOrKey(data);
                }
              }}
            />
            <Pressable
              style={styles.closeCameraBtn}
              onPress={() => setIsCameraOpen(false)}
            >
              <Text style={styles.closeCameraText}>Fechar Câmera</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            style={styles.primaryBtn}
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
          >
            <Text style={styles.primaryBtnText}>Abrir Câmera para Ler QR Code</Text>
          </Pressable>
        )}
      </View>

      {/* 2. Importar XML Fiscal ou Chave / URL */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          2. Importar Arquivo XML Oficial ou Informar Chave (44 dígitos)
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.secondaryBtn}
          onPress={() => void handleImportXmlFile()}
        >
          <Text style={styles.secondaryBtnText}>
            Selecionar Arquivo XML da NFC-e / NF-e
          </Text>
        </Pressable>

        <Text style={styles.label}>
          Ou cole a URL do QR Code / Chave de Acesso (44 dígitos):
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Ex.: http://nfe.sefaz.ba.gov.br/... ou 292610..."
          placeholderTextColor="#64748B"
          value={manualInput}
          onChangeText={setManualInput}
        />

        <View style={styles.rowBtns}>
          <Pressable
            style={[styles.primaryBtn, { flex: 1 }]}
            onPress={() => handleProcessQrOrKey(manualInput)}
          >
            <Text style={styles.primaryBtnText}>Validar Chave / QR</Text>
          </Pressable>
          <Pressable
            style={[styles.assistedBtn, { flex: 1 }]}
            onPress={handleStartAssistedManual}
          >
            <Text style={styles.assistedBtnText}>Nota Manual Assistida</Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Histórico de Notas Fiscais Importadas */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Notas Fiscais Importadas ({receipts.length})
        </Text>
        {receipts.length === 0 ? (
          <Text style={styles.emptyText}>
            Nenhuma nota fiscal registrada ainda. Escaneie um QR Code ou importe um XML
            para construir seu histórico de preços de supermercado.
          </Text>
        ) : (
          receipts.map((r) => (
            <Pressable
              key={r.id}
              style={styles.receiptRow}
              onPress={() => router.push(`/receipts/${r.id}`)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.receiptMerchant}>
                  {r.merchant_trade_name || r.merchant_name}
                </Text>
                <Text style={styles.receiptMeta}>
                  Data: {formatDateBR(r.issued_at.slice(0, 10))} • UF: {r.issuer_uf} •
                  Origem: {r.source_type}
                </Text>
              </View>
              <Text style={styles.receiptAmount}>
                {formatCurrencyBRL(r.total_paid_amount)}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    padding: 18,
    paddingTop: 44,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '800',
  },
  compareBtn: {
    backgroundColor: '#0C4A6E',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  compareBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#450A0A',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  cameraWrapper: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  closeCameraBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeCameraText: {
    color: '#FFF',
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  secondaryBtnText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
    marginBottom: 12,
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  assistedBtn: {
    backgroundColor: '#334155',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  assistedBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  receiptMerchant: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  receiptMeta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  receiptAmount: {
    color: '#34D399',
    fontSize: 15,
    fontWeight: '800',
  },
});
