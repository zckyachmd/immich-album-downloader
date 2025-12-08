# Security Policy

## Supported Versions

We actively support and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Immich Album Downloader seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send an email to the repository maintainer (check GitHub profile for contact information)
2. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature if available
3. **Direct Message**: Contact the maintainer through GitHub

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Suggested fix (if any)
- Your contact information (optional, but helpful for follow-up questions)

### What to Expect

- **Acknowledgment**: You will receive an acknowledgment within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 7 days
- **Updates**: We will keep you informed of our progress
- **Resolution**: We will notify you when the vulnerability is resolved

### Disclosure Policy

- We will work with you to understand and resolve the issue quickly
- We will credit you for the discovery (if you wish)
- We will not disclose the vulnerability publicly until a fix is available
- We will coordinate the disclosure with you

## Security Best Practices

### For Users

1. **API Key Security**
   - Never commit your API key to version control
   - Use environment variables or `.env` files (and ensure `.env` is in `.gitignore`)
   - Rotate your API key regularly
   - Use the minimum required permissions for your API key

2. **Network Security**
   - Always use HTTPS when connecting to your Immich server
   - Verify SSL certificates (don't disable SSL verification in production)
   - Use secure networks when downloading sensitive content

3. **File Permissions**
   - Ensure downloaded files have appropriate permissions
   - Protect your download directory from unauthorized access
   - Regularly review and audit downloaded content

4. **Environment Variables**
   - Keep your `.env` file secure and private
   - Don't share your `.env` file
   - Use different API keys for different environments

5. **Docker Security**
   - Use official images from trusted sources
   - Keep Docker images updated
   - Review and understand what the container does before running it
   - Use read-only volumes when possible

### Security Features

This project includes the following security features:

- ✅ Environment variable validation
- ✅ Path traversal protection
- ✅ Secure file permissions
- ✅ Log sanitization (sensitive data is not logged)
- ✅ HTTPS validation
- ✅ Rate limiting to prevent API abuse
- ✅ Input validation and sanitization
- ✅ Health checks
- ✅ SQL injection protection (using parameterized queries)
- ✅ Secure database file permissions

## Known Security Considerations

### API Key Storage

- API keys are stored in environment variables or `.env` files
- Never commit `.env` files to version control
- The `.env` file is included in `.gitignore`

### Network Communication

- The tool communicates with your Immich server using HTTPS
- SSL certificate verification is enabled by default
- You can disable SSL verification for self-signed certificates (development only)

### File System Access

- The tool writes files to the specified output directory
- Path traversal attacks are prevented through validation
- File permissions are set securely (database files: 600, directories: 700)

### Database Security

- SQLite database uses WAL mode for better concurrency
- Database files have restricted permissions (600)
- Database directory has restricted permissions (700)
- Foreign key constraints are enabled

## Security Updates

Security updates will be released as patch versions (e.g., 1.0.1, 1.0.2) and will be clearly marked in release notes.

## Third-Party Dependencies

We regularly update dependencies to address security vulnerabilities. You can check for known vulnerabilities using:

```bash
pnpm audit
```

## Additional Resources

- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Note**: This is an unofficial tool and is not affiliated with the Immich project. Always follow Immich's security guidelines for your server setup.
