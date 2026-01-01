# Security Policy

**TDS QR - TV Display Slides + QR**

Last Updated: January 2025

---

## Our Commitment to Security

TDS QR is designed with security as a fundamental principle. We believe that a simple, local-first architecture is the most secure approach for a display application.

---

## Security Architecture

### No Cloud, No Risk

TDS QR operates entirely without cloud infrastructure:

- **No servers** to be compromised
- **No databases** to be breached
- **No user accounts** to be hacked
- **No passwords** to be stolen

Your data exists only on your devices, eliminating entire categories of security vulnerabilities.

### Local Network Only

All communication between TDS QR devices occurs exclusively on your local WiFi network:

- Data never traverses the public internet
- No external endpoints or APIs
- No exposure to remote attacks
- Protected by your network's security

---

## Connection Security

### Device Pairing

TDS QR uses a secure pairing mechanism:

1. **QR Code Method**
   - Unique connection URL generated for each session
   - Contains encrypted connection parameters
   - Valid only for the current session

2. **PIN Method**
   - 6-digit randomly generated PIN
   - New PIN generated each time TV Mode starts
   - PIN verification required before connection

### Authentication Flow

```
TV Device                     Control Device
    |                              |
    |-- Generate PIN/QR ---------> |
    |                              |
    |<-------- Connection Request -|
    |                              |
    |-- Verify PIN --------------> |
    |                              |
    |<----- Authenticated ---------|
    |                              |
    |<===== Secure Channel =======>|
```

### Session Security

- New PIN generated for each TV Mode session
- Connection terminates when either device exits
- No persistent credentials stored
- Manual reconnection required after disconnection

---

## Data Security

### Data at Rest

Data stored on your device:

| Data Type | Storage Method |
|-----------|---------------|
| QR Codes | Local app storage, device-encrypted |
| Images | Local app storage, device-encrypted |
| Settings | Local preferences, device-encrypted |

All local storage benefits from iOS device encryption when you use a passcode/Face ID/Touch ID.

### Data in Transit

Data transferred between devices:

- Transmitted only over local WiFi
- Standard TCP/IP protocols
- No sensitive personal data transmitted
- Content limited to QR info and images

### Data Lifecycle

```
Create → Store Locally → Transfer Locally → Display → Delete
         (your device)   (local network)   (TV device)  (your control)
```

---

## Permissions & Access

### Minimal Permissions

TDS QR requests only essential permissions:

| Permission | Purpose | Required |
|------------|---------|----------|
| Camera | Scan QR codes for pairing | Optional* |
| Photo Library | Select images for display | Optional |
| Local Network | Connect devices | Required |

*Can use PIN entry instead of QR scanning

### Permission Handling

- Permissions requested only when needed
- Clear explanation provided before each request
- App functions with denied permissions (with limitations)
- No background access to camera or photos

---

## Network Security

### Network Requirements

- Both devices must be on the same WiFi network
- Network isolation provides security boundary
- Enterprise networks with device isolation may block functionality

### Firewall Considerations

TDS QR uses:
- Local network discovery
- Direct device-to-device TCP connections
- No incoming connections from internet required

### Public Network Caution

We recommend using TDS QR on trusted networks:

- **Recommended:** Private home/office WiFi
- **Acceptable:** Password-protected business networks
- **Caution:** Public WiFi (coffee shops, hotels)

On public networks, other users on the same network could potentially see the connection QR code if displayed publicly.

---

## Security Best Practices

### For Users

1. **Use trusted networks**
   - Connect devices on private WiFi when possible
   - Avoid open public networks

2. **Physical security**
   - Don't leave the PIN displayed unattended
   - Be aware of who can see your TV screen

3. **Device security**
   - Keep iOS updated
   - Use device passcode/biometrics
   - Don't jailbreak devices running TDS QR

4. **Content awareness**
   - Review content before displaying publicly
   - Don't display sensitive URLs in public spaces

### For Business Users

1. **Network segmentation**
   - Consider a dedicated display network
   - Use guest network isolation if appropriate

2. **Access control**
   - Limit who has access to Control Mode devices
   - Monitor which devices are in TV Mode

3. **Content review**
   - Establish content approval processes
   - Review QR code destinations regularly

---

## Vulnerability Disclosure

### Reporting Security Issues

If you discover a security vulnerability in TDS QR, please report it responsibly:

**Email:** [security@yourwebsite.com]

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

### Our Response

We commit to:
- Acknowledging reports within 48 hours
- Investigating all reported issues
- Providing updates on remediation progress
- Crediting reporters (if desired) upon fix

### Scope

In scope:
- TDS QR iOS application
- Device-to-device communication protocol
- Local data storage

Out of scope:
- iOS operating system vulnerabilities
- Network infrastructure issues
- Physical device security

---

## Security Updates

### Update Policy

- Security patches released as soon as possible
- Updates distributed through App Store
- Critical issues may warrant expedited review

### Staying Updated

- Enable automatic app updates
- Check App Store for updates regularly
- Review release notes for security information

---

## Compliance

### Industry Standards

TDS QR follows security best practices:
- Minimal data collection
- Principle of least privilege
- Defense in depth
- Secure by design

### Certifications

TDS QR is:
- Distributed through Apple App Store (App Review compliance)
- Designed for enterprise deployment

---

## Contact

For security-related inquiries:

**Security Team:** [security@yourwebsite.com]

**General Support:** [support@yourwebsite.com]

---

© 2024 TDS QR. All rights reserved.
