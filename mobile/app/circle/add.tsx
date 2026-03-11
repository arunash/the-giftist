import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost } from '@/lib/api'
import { requestContactsAccess, getPhoneContacts, type NormalizedContact } from '@/lib/contacts'
import { haptic } from '@/lib/haptics'
import { HapticButton } from '@/components/shared/HapticButton'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { colors } from '@/constants/colors'
import { X, BookUser, Plus, Check, User, Search } from 'lucide-react-native'

export default function AddCircleMemberScreen() {
  const queryClient = useQueryClient()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [contacts, setContacts] = useState<NormalizedContact[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loadingContacts, setLoadingContacts] = useState(false)

  const addMutation = useMutation({
    mutationFn: (data: { phone: string; name?: string }) =>
      apiPost('/api/circle', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circle'] })
    },
  })

  const handleAddManual = async () => {
    if (!phone) return
    try {
      await addMutation.mutateAsync({ phone, name: name || undefined })
      haptic.success()
      router.back()
    } catch (e: any) {
      haptic.error()
      Alert.alert('Error', e.message || 'Failed to add member')
    }
  }

  const handleImportContacts = async () => {
    setLoadingContacts(true)
    const granted = await requestContactsAccess()
    if (!granted) {
      Alert.alert(
        'Permission Required',
        'Please allow access to Contacts in Settings to import your gift circle.'
      )
      setLoadingContacts(false)
      return
    }

    const phoneContacts = await getPhoneContacts()
    setContacts(phoneContacts)
    setLoadingContacts(false)
  }

  const toggleContact = (phone: string) => {
    haptic.selection()
    const next = new Set(selected)
    if (next.has(phone)) {
      next.delete(phone)
    } else {
      next.add(phone)
    }
    setSelected(next)
  }

  const handleAddSelected = async () => {
    try {
      const promises = Array.from(selected).map((contactPhone) => {
        const contact = contacts.find((c) => c.phone === contactPhone)
        return addMutation.mutateAsync({
          phone: contactPhone,
          name: contact?.name,
        })
      })
      await Promise.all(promises)
      haptic.success()
      router.back()
    } catch (e: any) {
      haptic.error()
      Alert.alert('Error', e.message || 'Failed to add members')
    }
  }

  const filteredContacts = search
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search)
      )
    : contacts

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <HapticButton onPress={() => router.back()}>
            <X size={24} color={colors.foreground} />
          </HapticButton>
          <Text className="text-lg font-sans-semibold text-foreground">Add to Circle</Text>
          <View style={{ width: 24 }} />
        </View>

        {contacts.length === 0 ? (
          <View className="flex-1 px-4 pt-4">
            {/* Manual add */}
            <Text className="text-sm font-sans-medium text-foreground mb-1.5">Phone Number</Text>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground font-sans mb-3"
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text className="text-sm font-sans-medium text-foreground mb-1.5">Name (optional)</Text>
            <TextInput
              className="bg-card border border-border rounded-xl px-4 py-3 text-base text-foreground font-sans mb-4"
              placeholder="Their name"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />

            <HapticButton
              onPress={handleAddManual}
              disabled={!phone || addMutation.isPending}
              className="bg-primary rounded-xl py-3.5 flex-row items-center justify-center mb-6"
            >
              {addMutation.isPending ? (
                <LoadingSpinner size="small" color="#fff" />
              ) : (
                <>
                  <Plus size={18} color="#fff" />
                  <Text className="text-base font-sans-semibold text-white ml-2">Add Member</Text>
                </>
              )}
            </HapticButton>

            {/* Import from contacts */}
            <View className="flex-row items-center my-4">
              <View className="flex-1 h-px bg-border" />
              <Text className="mx-4 text-sm text-muted">or</Text>
              <View className="flex-1 h-px bg-border" />
            </View>

            <HapticButton
              onPress={handleImportContacts}
              disabled={loadingContacts}
              className="bg-card border border-border rounded-xl py-3.5 flex-row items-center justify-center"
            >
              {loadingContacts ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <BookUser size={18} color={colors.foreground} />
                  <Text className="text-base font-sans-medium text-foreground ml-2">
                    Import from Contacts
                  </Text>
                </>
              )}
            </HapticButton>
          </View>
        ) : (
          <>
            {/* Contact search */}
            <View className="px-4 py-3">
              <View className="flex-row items-center bg-card border border-border rounded-xl px-3">
                <Search size={18} color={colors.muted} />
                <TextInput
                  className="flex-1 ml-2 py-3 text-base text-foreground font-sans"
                  placeholder="Search contacts..."
                  placeholderTextColor={colors.muted}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
            </View>

            <FlatList
              data={filteredContacts}
              keyExtractor={(c) => c.phone}
              renderItem={({ item: contact }) => {
                const isSelected = selected.has(contact.phone)
                return (
                  <HapticButton
                    onPress={() => toggleContact(contact.phone)}
                    hapticType="selection"
                    className="flex-row items-center px-4 py-3 border-b border-border"
                  >
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                        isSelected ? 'bg-primary border-primary' : 'border-border'
                      }`}
                    >
                      {isSelected && <Check size={14} color="#fff" />}
                    </View>
                    <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center mr-3">
                      <User size={14} color={colors.primary.DEFAULT} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-sans-medium text-foreground">
                        {contact.name}
                      </Text>
                      <Text className="text-xs text-muted">{contact.originalPhone}</Text>
                    </View>
                  </HapticButton>
                )
              }}
            />

            {selected.size > 0 && (
              <View className="px-4 py-3 border-t border-border">
                <HapticButton
                  onPress={handleAddSelected}
                  disabled={addMutation.isPending}
                  className="bg-primary rounded-xl py-3.5 flex-row items-center justify-center"
                >
                  <Text className="text-base font-sans-semibold text-white">
                    Add {selected.size} Contact{selected.size > 1 ? 's' : ''}
                  </Text>
                </HapticButton>
              </View>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
