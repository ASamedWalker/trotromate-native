import { Stack } from 'expo-router'

export default function RegisterLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="review" />
      <Stack.Screen name="pin" />
      <Stack.Screen name="survey" />
    </Stack>
  )
}
