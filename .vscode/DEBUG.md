# Руководство по отладке Tauri в VS Code

## Необходимые расширения

Установите следующие расширения VS Code (VS Code предложит их автоматически):

### Для отладки Rust:
- **CodeLLDB** (`vadimcn.vscode-lldb`) - рекомендуется, включает lldb-dap
- **C/C++** (`ms-vscode.cpptools`) - запасной вариант для Windows

### Для разработки:
- **rust-analyzer** (`rust-lang.rust-analyzer`) - IntelliSense для Rust
- **Tauri** (`tauri-apps.tauri-vscode`) - поддержка Tauri
- **ESLint** (`dbaeumer.vscode-eslint`) - линтинг TypeScript/React

### Для отладки фронтенда:
- **Debugger for Chrome** (`msjsdiag.debugger-for-chrome`)
- **Microsoft Edge DevTools** (`ms-edgedevtools.vscode-edge-devtools`)

## Выбор отладчика

У вас есть два варианта для отладки Rust кода:

### Вариант 1: LLDB (рекомендуется)
- Используйте конфигурации с названием "(LLDB)"
- Требует расширение **CodeLLDB**
- Лучше работает с Rust
- Кроссплатформенный отладчик

### Вариант 2: Windows C++ Debugger
- Используйте конфигурации с названием "(Windows C++)"
- Требует расширение **C/C++**
- Использует нативный Windows отладчик (cppvsdbg)
- Запасной вариант если LLDB не работает

## Конфигурации отладки

### 1. Debug Tauri App (LLDB) - Рекомендуется
**Что делает:**
- Собирает Rust проект в debug режиме
- Запускает приложение с LLDB отладчиком

**Как использовать:**
1. Убедитесь что расширение CodeLLDB установлено
2. Нажмите `F5` или выберите эту конфигурацию
3. Устанавливайте breakpoint'ы в `.rs` файлах
4. Приложение запустится с отладчиком

**Переменные окружения:**
- `RUST_BACKTRACE=1` - полные стэк-трейсы
- `RUST_LOG=debug` - debug логирование

### 2. Debug Tauri App (Windows C++) - Запасной вариант
**Что делает:**
- То же самое, но использует Windows отладчик вместо LLDB

**Когда использовать:**
- Если CodeLLDB не работает или не установлен
- Если видите ошибку "lldb-dap not found"

### 3. Attach to Process - Подключение к процессу
Два варианта: LLDB или Windows отладчик

**Как использовать:**
1. Запустите приложение вручную: `npm run tauri:dev`
2. Выберите конфигурацию "Attach to Process"
3. Выберите процесс `claude-code-history-viewer.exe` из списка
4. Отладчик подключится к работающему приложению

### 4. Run Tauri Dev (No Debugger) - Запуск без отладки
**Что делает:**
- Просто запускает `npm run tauri:dev` в терминале
- Отладчик не подключается
- Быстрее чем с отладчиком

**Когда использовать:**
- Для обычного тестирования приложения
- Когда отладка не нужна

### 5. Debug Frontend (Edge/Chrome) - Отладка фронтенда
**Что делает:**
- Запускает Vite dev сервер
- Открывает браузер с подключенным отладчиком

**Как использовать:**
1. Выберите "Debug Frontend (Edge)" или "Debug Frontend (Chrome)"
2. Устанавливайте breakpoint'ы в `.ts`, `.tsx` файлах
3. Используйте DevTools для отладки React компонентов

### 6. Debug Full Stack - Комбинированная отладка
Два варианта: LLDB+Edge или Windows+Edge

**Что делает:**
- Одновременно запускает отладку Rust и фронтенда
- Позволяет отлаживать IPC вызовы между фронтендом и бэкендом

**Как использовать:**
1. Выберите "Debug Full Stack (LLDB + Edge)" или Windows вариант
2. Breakpoint'ы работают и в Rust, и в TypeScript
3. Отладка работает одновременно в обеих частях приложения

## Горячие клавиши

- `F5` - Запустить отладку
- `Shift+F5` - Остановить отладку
- `F9` - Установить/убрать breakpoint
- `F10` - Step Over (следующая строка)
- `F11` - Step Into (войти в функцию)
- `Shift+F11` - Step Out (выйти из функции)
- `Ctrl+Shift+F5` - Перезапустить отладку

## Задачи (Tasks)

Доступные задачи в меню `Terminal > Run Task...`:

- **tauri dev** - запуск dev версии приложения
- **tauri build** - сборка production версии
- **vite dev** - запуск только фронтенд сервера
- **rust:build-debug** - сборка Rust в debug режиме
- **rust:build-release** - сборка Rust в release режиме

## Решение проблем

### "lldb-dap not supported" или похожая ошибка

**Проблема:** Расширение CodeLLDB не установлено или не настроено

**Решение:**
1. Установите расширение **CodeLLDB** из VS Code Marketplace
2. Перезапустите VS Code
3. Если не помогло, используйте конфигурацию "Debug Tauri App (Windows C++)" вместо LLDB

### "Could not find lldb-dap"

**Проблема:** CodeLLDB не может найти бинарник lldb-dap

**Решение:**
1. Переустановите расширение CodeLLDB
2. Или используйте Windows C++ конфигурацию вместо LLDB
3. Расширение CodeLLDB включает lldb-dap автоматически

### Breakpoint'ы не срабатывают

**Проблема:** Breakpoint показывает серый круг

**Решение:**
1. Убедитесь что проект собран в **debug** режиме (не release)
2. Проверьте что путь к exe правильный в launch.json
3. Пересоберите проект: `cargo build --manifest-path=src-tauri/Cargo.toml`
4. Попробуйте другой отладчик (LLDB → Windows или наоборот)

### "Cannot attach to process"

**Проблема:** Не удается подключиться к процессу

**Решение:**
1. Убедитесь что процесс `claude-code-history-viewer.exe` запущен
2. Проверьте что процесс собран в debug режиме
3. Попробуйте запустить VS Code от имени администратора

### Фронтенд не подключается

**Проблема:** "Cannot connect to runtime process"

**Решение:**
1. Убедитесь что Vite dev сервер запущен (`npm run dev`)
2. Проверьте что порт 5173 свободен
3. Откройте http://localhost:5173 в браузере вручную
4. Проверьте что расширение Debugger for Chrome установлено

### Отладка очень медленная

**Проблема:** Приложение тормозит в debug режиме

**Решение:**
1. Для тестирования производительности используйте release сборку
2. Отключите ненужные breakpoint'ы
3. Используйте условные breakpoint'ы (правый клик → Edit Breakpoint → Condition)
4. Используйте конфигурацию "Run Tauri Dev (No Debugger)" для обычного запуска

## Отладка IPC вызовов (Rust ↔ Frontend)

**Для отладки взаимодействия между фронтендом и бэкендом:**

1. Используйте конфигурацию "Debug Full Stack"
2. Установите breakpoint в Rust команде:
   ```rust
   // src-tauri/src/commands/session.rs
   #[tauri::command]
   pub async fn load_session_messages(...) -> Result<...> {
       // <-- breakpoint здесь
   ```
3. Установите breakpoint во фронтенде перед вызовом:
   ```typescript
   // src/store/useAppStore.ts
   const messages = await invoke('load_session_messages', { ... });
   // <-- breakpoint здесь
   ```
4. Выполните действие в UI
5. Отладчик остановится на обоих breakpoint'ах

## Логирование

### Rust логи
```rust
use log::{debug, info, warn, error};

debug!("Отладочное сообщение: {:?}", data);
info!("Информация: {}", message);
warn!("Предупреждение");
error!("Ошибка: {}", err);
```

Логи видны в консоли при запуске с `RUST_LOG=debug`.

### Frontend логи
```typescript
console.log('Debug:', data);
console.warn('Warning:', message);
console.error('Error:', error);
```

Логи видны в Browser DevTools (F12).

## Debug vs Release сборки

**Debug (по умолчанию):**
- Без оптимизаций
- Быстрая компиляция (~3 минуты)
- Большой размер (~200MB)
- Работает отладчик

**Release:**
```bash
npm run tauri:build
# или
cargo build --release --manifest-path=src-tauri/Cargo.toml
```
- С оптимизациями
- Медленная компиляция (~10 минут)
- Маленький размер (~20MB)
- Отладчик ограничен

## Дополнительная информация

- [LLDB DAP Documentation](https://lldb.llvm.org/use/lldb-dap.html)
- [Tauri Debugging Guide](https://tauri.app/v2/guides/debugging/)
- [CodeLLDB Extension](https://github.com/vadimcn/vscode-lldb)
- [VS Code Debugging](https://code.visualstudio.com/docs/editor/debugging)

## Краткая шпаргалка

**Быстрый старт (рекомендуется):**
1. Установите расширение CodeLLDB
2. Нажмите F5
3. Выберите "Debug Tauri App (LLDB)"

**Если LLDB не работает:**
1. Установите расширение C/C++
2. Нажмите F5
3. Выберите "Debug Tauri App (Windows C++)"

**Отладка фронтенда:**
1. Нажмите F5
2. Выберите "Debug Frontend (Edge)"

**Полная отладка (Rust + React):**
1. Нажмите F5
2. Выберите "Debug Full Stack (LLDB + Edge)"
