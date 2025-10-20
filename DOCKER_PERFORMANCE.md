# 🐳 Docker Performance Optimization for WebSSH

## Проблема
При запуске в Docker контейнере копирование текста в терминале работает медленно по сравнению с локальным запуском.

## Причины и решения

### 1. **WebSocket настройки**
- ✅ Отключена компрессия (`perMessageDeflate: false`)
- ✅ Увеличен максимальный размер payload (16MB)
- ✅ Добавлен keep-alive
- ✅ Оптимизирована обработка ошибок

### 2. **Терминал настройки**
- ✅ Отключена прозрачность (`allowTransparency: false`)
- ✅ Отключен звук (`bellStyle: 'none'`)
- ✅ Оптимизированы настройки прокрутки
- ✅ Улучшена обработка буферов

### 3. **Docker конфигурация**
- ✅ Увеличен shared memory (`shm_size: 64m`)
- ✅ Настроены ulimits для файлов
- ✅ Добавлены security options
- ✅ Оптимизированы переменные окружения

### 4. **Системные настройки**

#### На хосте (сервере):
```bash
# Увеличить лимиты для Docker
echo 'vm.max_map_count=262144' >> /etc/sysctl.conf
sysctl -p

# Оптимизировать сетевые настройки
echo 'net.core.rmem_max = 16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' >> /etc/sysctl.conf
sysctl -p
```

#### В docker-compose.yml:
```yaml
services:
  webssh:
    # ... existing config ...
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
    # Добавить для лучшей производительности
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
```

### 5. **Мониторинг производительности**

#### Проверка ресурсов:
```bash
# Мониторинг в реальном времени
docker stats webssh_webssh_1

# Проверка логов
docker-compose logs -f webssh

# Проверка сетевых соединений
docker exec webssh_webssh_1 netstat -tuln
```

#### Тестирование копирования:
1. Откройте http://localhost:8443
2. Подключитесь к серверу
3. Скопируйте большой объем текста (например, `cat /var/log/syslog`)
4. Проверьте скорость отклика

### 6. **Дополнительные оптимизации**

#### Если проблема остается:
```bash
# Увеличить shared memory
docker-compose down
# В docker-compose.yml изменить:
# shm_size: 128m  # вместо 64m

# Добавить CPU ограничения
# deploy:
#   resources:
#     limits:
#       cpus: '1.0'
```

#### Для продакшена:
```bash
# Использовать production образ
FROM node:22-alpine AS production
# ... оптимизации для продакшена
```

## Тестирование

Запустите тест производительности:
```bash
./test-docker-performance.sh
```

## Результат
После применения всех оптимизаций копирование в терминале должно работать так же быстро, как и при локальном запуске.

## Мониторинг
- Используйте `docker stats` для мониторинга ресурсов
- Проверяйте логи на наличие ошибок WebSocket
- Тестируйте с разными объемами данных
