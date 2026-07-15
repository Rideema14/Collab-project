import { redirect } from 'next/navigation';

/** The platform home is the product. Send people straight to it; the guard handles auth. */
export default function RootPage() {
  redirect('/home');
}
