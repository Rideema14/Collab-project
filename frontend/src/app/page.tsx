import { redirect } from 'next/navigation';

/** The board is the product. Send people straight to it; the guard handles auth. */
export default function HomePage() {
  redirect('/projects');
}
