.PHONY: help update serve update-and-share schedule unschedule

# Cross-platform "open in browser" helper
ifeq ($(OS),Windows_NT)
	OPEN := start
else
	UNAME_S := $(shell uname -s)
	ifeq ($(UNAME_S),Darwin)
		OPEN := open
	else
		OPEN := xdg-open
	endif
endif

PY := python3

help:
	@echo "Gold ETF India — available commands:"
	@echo ""
	@echo "  make update             Fetch latest NAVs and rewrite data.js"
	@echo "  make serve              Open the report in your default browser"
	@echo "  make update-and-share   Update data + open in browser"
	@echo "  make schedule           (macOS) Install launchd job: monthly auto-update"
	@echo "  make unschedule         (macOS) Remove the auto-update job"
	@echo ""
	@echo "✨ No setup needed — Python 3.8+ stdlib is the only dependency."
	@echo ""

update:
	$(PY) update_data.py

serve:
	$(OPEN) index.html

update-and-share: update serve

schedule:
	@mkdir -p $$HOME/Library/LaunchAgents
	@sed "s|REPO_PATH|$$(pwd)|g; s|PYTHON_BIN|$$(which $(PY))|g" launchd/com.goldetf.update.plist > $$HOME/Library/LaunchAgents/com.goldetf.update.plist
	@launchctl unload $$HOME/Library/LaunchAgents/com.goldetf.update.plist 2>/dev/null || true
	@launchctl load $$HOME/Library/LaunchAgents/com.goldetf.update.plist
	@echo "✅ Scheduled. Auto-updates on the 1st of every month at 09:00."
	@echo "   Logs: /tmp/goldetf-update.log"

unschedule:
	@launchctl unload $$HOME/Library/LaunchAgents/com.goldetf.update.plist 2>/dev/null || true
	@rm -f $$HOME/Library/LaunchAgents/com.goldetf.update.plist
	@echo "🗑️  Unscheduled."
