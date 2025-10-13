import { useAuth } from "../context/auth-context.jsx"

// Lightweight convenience hook if components only need user + logout.
export function useUser() {
  const { me, logout, accessToken, ready } = useAuth()
  return { user: me, logout, accessToken, ready }
}

export default useUser
