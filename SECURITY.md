# Segurança e dados infantis — BytePets

Este repositório é uma base para **homologação**. A instalação online com dados reais de crianças requer avaliação jurídica e de segurança antes de uso público.

- Jamais faça commit de `.env`, bancos `.sqlite`, arquivos de produção, backups, chaves de assinatura APK, relatórios escolares reais ou mídias de alunos.
- Na VPS, use somente `compose.yaml` + `compose.vps.yaml`, com DNS e TLS confiáveis. O banco PostgreSQL deve permanecer sem porta publicada.
- Faça backups cifrados e testes periódicos de restauração de PostgreSQL e do volume `media_data`.
- Ajuste limitação de acesso, revisões de papéis escolares, retenção/exclusão de dados, monitoramento de eventos e consentimento adequado.
- O script de importação SQLite recusa um destino PostgreSQL com contas pré-existentes para reduzir o risco de mistura de bancos.
- Não execute réplicas concorrentes da API sem uma migração do DB adapter para arquitetura assíncrona com locks, transações e testes específicos.
