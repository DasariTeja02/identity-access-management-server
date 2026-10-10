package com.iam.security;

public class UserAgentUtils {

    public static class DeviceInfo {
        private final String deviceType;
        private final String browser;
        private final String operatingSystem;

        public DeviceInfo(String deviceType, String browser, String operatingSystem) {
            this.deviceType = deviceType;
            this.browser = browser;
            this.operatingSystem = operatingSystem;
        }

        public String getDeviceType() {
            return deviceType;
        }

        public String getBrowser() {
            return browser;
        }

        public String getOperatingSystem() {
            return operatingSystem;
        }
    }

    public static DeviceInfo parseUserAgent(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return new DeviceInfo("Desktop", "Unknown Browser", "Unknown OS");
        }

        String ua = userAgent.toLowerCase();

        // 1. Operating System
        String os = "Unknown OS";
        if (ua.contains("windows")) {
            os = "Windows";
        } else if (ua.contains("android")) {
            os = "Android";
        } else if (ua.contains("iphone") || ua.contains("ipad") || ua.contains("ipod")) {
            os = "iOS";
        } else if (ua.contains("mac os") || ua.contains("macos")) {
            os = "macOS";
        } else if (ua.contains("linux")) {
            os = "Linux";
        } else if (ua.contains("postman")) {
            os = "Postman Runtime";
        }

        // 2. Device Type
        String deviceType = "Desktop";
        if (ua.contains("mobile") || ua.contains("iphone") || ua.contains("android")) {
            deviceType = "Mobile";
        } else if (ua.contains("tablet") || ua.contains("ipad")) {
            deviceType = "Tablet";
        } else if (ua.contains("postman") || ua.contains("curl") || ua.contains("httpclient")) {
            deviceType = "API Client";
        }

        // 3. Browser
        String browser = "Unknown Browser";
        if (ua.contains("edg/") || ua.contains("edge/")) {
            browser = "Edge";
        } else if (ua.contains("chrome/") && !ua.contains("chromium")) {
            browser = "Chrome";
        } else if (ua.contains("firefox/")) {
            browser = "Firefox";
        } else if (ua.contains("safari/") && !ua.contains("chrome/")) {
            browser = "Safari";
        } else if (ua.contains("postman")) {
            browser = "Postman";
        } else if (ua.contains("curl")) {
            browser = "cURL";
        }

        return new DeviceInfo(deviceType, browser, os);
    }
}
