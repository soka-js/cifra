import { vi } from 'vitest';

// La "petición" de cada prueba: cookies y encabezados en memoria (ver fake-next.ts).
vi.mock('next/headers', async () => {
  const { jar, requestHeaders } = await import('./fake-next');
  return {
    cookies: async () => ({
      get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      has: (name: string) => jar.has(name),
      set: (name: string, value: string) => {
        jar.set(name, value);
      },
      delete: (name: string) => {
        jar.delete(name);
      },
    }),
    headers: async () => requestHeaders,
  };
});

// redirect() y notFound() cortan la ejecución lanzando, igual que en Next; aquí lanzan señales propias.
vi.mock('next/navigation', async () => {
  const { RedirectSignal, NotFoundSignal } = await import('./fake-next');
  return {
    redirect: (url: string) => {
      throw new RedirectSignal(url);
    },
    notFound: () => {
      throw new NotFoundSignal();
    },
  };
});

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));
