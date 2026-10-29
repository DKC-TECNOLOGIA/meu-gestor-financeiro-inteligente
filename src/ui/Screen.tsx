import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControlProps,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { AppText } from './AppText';
import { spacing, touchTarget, useThemeColors } from './theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, showBack, onBack, right }: ScreenHeaderProps) {
  const router = useRouter();
  const c = useThemeColors();
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingTop: spacing.sm,
        paddingBottom: spacing.lg,
      }}
    >
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={handleBack}
          hitSlop={8}
          style={({ pressed }) => ({
            width: touchTarget - 8,
            height: touchTarget - 8,
            marginLeft: -spacing.sm,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? c.surfaceMuted : 'transparent',
          })}
        >
          <ChevronLeft color={c.text} size={24} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant={showBack ? 'heading' : 'title'} accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export interface ScreenProps {
  children: ReactNode;
  header?: ScreenHeaderProps;
  scroll?: boolean;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
  backgroundColor?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function Screen({
  children,
  header,
  scroll = true,
  footer,
  contentStyle,
  bottomInset = 0,
  backgroundColor,
  refreshControl,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const bg = backgroundColor ?? c.background;
  const padding: ViewStyle = {
    paddingHorizontal: spacing.xl,
    paddingTop: insets.top + spacing.sm,
  };

  const body = (
    <>
      {header ? <ScreenHeader {...header} /> : null}
      {children}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          contentContainerStyle={[
            padding,
            { paddingBottom: spacing.xxxl + bottomInset + (footer ? 0 : insets.bottom) },
            contentStyle,
          ]}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{body}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            backgroundColor: c.surface,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
