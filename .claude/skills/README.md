# Skills de Claude Code de este repo

Copiadas tal cual desde sus repos (ver `LICENSES.md`), sin hooks ni dependencias:
se cargan solas al abrir el proyecto, también en Claude Code web.

| Skill | Origen | Para qué |
| --- | --- | --- |
| `ponytail` | DietrichGebert/ponytail v4.10.0 | Modo "senior flojo": la solución más corta que funcione. Siempre activo vía `CLAUDE.md`; `/ponytail lite\|full\|ultra` cambia la intensidad. |
| `ponytail-review` | DietrichGebert/ponytail v4.10.0 | `/ponytail-review`: revisa un diff buscando solo sobreingeniería (qué borrar). |
| `interview-me` | addyosmani/agent-skills v0.6.9 | `/interview-me`: te entrevista una pregunta a la vez antes de programar algo ambiguo. |
| `incremental-implementation` | addyosmani/agent-skills v0.6.9 | Cambios en rebanadas chicas y verificables cuando se tocan varios archivos. |
| `debugging-and-error-recovery` | addyosmani/agent-skills v0.6.9 | Depuración por causa raíz cuando falla un script, el render o una API. |

Para actualizar: clona el repo de origen y vuelve a copiar el `SKILL.md`.
