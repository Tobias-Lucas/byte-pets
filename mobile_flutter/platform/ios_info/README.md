# iOS local development

Flutter on Windows can build Android; building iOS requires macOS and Xcode.
For local `http://` testing on iOS, App Transport Security must be configured deliberately and only for development.
Use HTTPS in production. Ensure your app's `Info.plist` contains any narrowly scoped exceptions required by your LAN environment.
The Flutter app itself blocks HTTP unless `BYTEPETS_ALLOW_HTTP=true` is defined at build time.
