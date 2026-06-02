# Implementation Plan: Bump Version Code & Enable Release Signing for AAB

This plan outlines bumping the Android application version (versionCode to 2, versionName to "1.1") and configuring release signing in Gradle using a generated keystore to resolve the Google Play Console error: `"All uploaded bundles must be signed."`

## User Review Required

> [!IMPORTANT]
> - **Versioning Bump**: We will increase `versionCode` from `1` to `2` and `versionName` from `"1.0"` to `"1.1"` in `frontend/android/app/build.gradle`.
> - **Keystore Generation**: We will generate a secure release signing keystore file named `saarlekha.keystore` inside the `frontend/android/app/` folder using the OpenJDK `keytool` utility.
> - **Gradle Signing Configuration**: We will update the `build.gradle` script to automatically sign the release bundle (`.aab` file) with this keystore during compilation.

---

## Proposed Changes

### Native Android Project Config

#### [MODIFY] [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle)
- Update `versionCode` to `2`.
- Update `versionName` to `"1.1"`.
- Configure `signingConfigs` section and associate the `release` configuration with the `release` build type:
  ```groovy
  android {
      ...
      signingConfigs {
          release {
              storeFile file("saarlekha.keystore")
              storePassword "saarlekha123"
              keyAlias "saarlekha-key"
              keyPassword "saarlekha123"
          }
      }
      buildTypes {
          release {
              ...
              signingConfig signingConfigs.release
          }
      }
  }
  ```

---

## Verification & Build Plan

### Execution Steps
1. **Generate Keystore**:
   Run the OpenJDK `keytool` command in `frontend/android/app` to generate `saarlekha.keystore`:
   ```powershell
   & "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v -keystore saarlekha.keystore -alias saarlekha-key -keyalg RSA -keysize 2048 -validity 10000 -storepass saarlekha123 -keypass saarlekha123 -dname "CN=Saarlekha Admin, OU=Operations, O=Saarlekha, L=Delhi, S=Delhi, C=IN"
   ```
2. **Apply build.gradle Changes**: Modify [build.gradle](file:///c:/claude/Saarlekha/frontend/android/app/build.gradle) with the version bump and signing details.
3. **Compile Release Bundle**:
   Re-compile the project assets:
   ```bash
   npm run build && npx cap sync
   ```
   Compile the signed App Bundle:
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   cd android
   .\gradlew.bat bundleRelease
   ```

### Output Validation
- Verify the existence of the newly generated signed `.aab` file at `frontend/android/app/build/outputs/bundle/release/app-release.aab`.
