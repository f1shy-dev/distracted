export default defineContentScript({
    matches: ["<all_urls>"],
    async main() {
        const url = window.location.href;
        let isTracking = false;
        let siteId: string | null = null;
        let timer: number | undefined;

        // Check if valid page (not internal)
        if (url.startsWith("chrome:") || url.startsWith("about:") || url.includes("blocked.html")) {
            return;
        }

        try {
            const response = await browser.runtime.sendMessage({
                type: "GET_SITE_INFO",
                url,
            });

            if (response && response.site && response.statsEnabled) {
                siteId = response.site.id;
                startTracking();
            }
        } catch (e) {
            // Ignore errors (e.g. extension context invalidated)
        }

        function startTracking() {
            if (isTracking) return;
            isTracking = true;

            // Update every 1 second
            timer = window.setInterval(sendUpdate, 1000);

            document.addEventListener("visibilitychange", handleVisibilityChange);
            window.addEventListener("beforeunload", sendUpdate);
        }

        function stopTracking() {
            if (!isTracking) return;
            isTracking = false;

            clearInterval(timer);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", sendUpdate);
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                clearInterval(timer);
            } else {
                timer = window.setInterval(sendUpdate, 1000);
            }
        }

        function sendUpdate() {
            if (!siteId || document.hidden) return;

            browser.runtime.sendMessage({
                type: "UPDATE_STATS",
                siteId,
                update: { addTime: 1000 }, // 1000ms = 1s
            }).catch(() => {
                stopTracking(); // Stop if extension invalid
            });
        }
    },
});
