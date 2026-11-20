import React from 'react';
import { isChunkLoadError, reloadOnceForChunks } from '../utils/lazyImport';

interface State {
  hasError: boolean;
}

/**
 * Остання лінія захисту: без нього будь-яка помилка рендеру дає порожній
 * екран. Для помилок завантаження чанків пробуємо одне перезавантаження,
 * інакше показуємо зрозумілий екран із кнопкою.
 */
class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error) && reloadOnceForChunks()) {
      return;
    }
    // Інші помилки лишаємо видимими для ourselves: екран нижче.
    console.error('App crashed', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <h1 className="text-lg font-bold text-gray-900">
            Сторінка не завантажилась
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Найчастіше це тимчасова проблема зі звʼязком або оновлення сайту.
            Спробуйте ще раз.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-xl bg-tesla-red text-white text-sm font-semibold hover:bg-red-700 transition-colors"
            >
              Оновити сторінку
            </button>
            <a
              href="/"
              className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors block"
            >
              На головну
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
