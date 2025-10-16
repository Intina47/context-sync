# Contributing to Context Sync

Thanks for your interest in contributing! 🎉

## How to Contribute

### Reporting Bugs

Found a bug? Please [open an issue](https://github.com/Intina47/context-sync/issues) with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Your OS and Node.js version
- Claude Desktop version

### Suggesting Features

Have an idea? [Start a discussion](https://github.com/Intina47/context-sync/discussions) or open an issue with:
- Description of the feature
- Use case / why it's needed
- Proposed implementation (optional)

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Setup

```bash
# Clone your fork
git clone https://github.com/Intina47/context-sync.git
cd context-sync

# Install dependencies
npm install

# Build
npm run build

# Test
tsx test.ts

# Run in development
npm run dev
```

### Code Style

- Use TypeScript strict mode
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Follow existing code patterns

### Testing

Before submitting a PR:
- Run `npm run build` successfully
- Test with Claude Desktop
- Verify on your OS

### Priority Contributions

We especially need help with:
- **Auto-detection** - Detect projects from filesystem
- **Cursor integration** - Make it work with Cursor IDE
- **VS Code extension** - Support GitHub Copilot
- **Documentation** - Improve guides and examples

## Questions?

Ask in [Discussions](https://github.com/Intina47/context-sync/discussions) or open an issue.

Thanks for contributing! 🚀