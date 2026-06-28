import { showToast } from '../components/ToastProvider'

export default function toast(opts) {
  // opts: { title, message, type, duration }
  showToast(opts)
}

export { showToast }
