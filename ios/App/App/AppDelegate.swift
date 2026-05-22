import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        configureRootWebViewScrolling()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        if url.scheme == "seed" {
            dispatchSeedUrlToWebView(url)
        }

        return ApplicationDelegateProxy.shared.application(app, open: url, options: options) || url.scheme == "seed"
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func configureRootWebViewScrolling() {
        guard let bridgeViewController = window?.rootViewController as? CAPBridgeViewController else {
            return
        }

        let appBackground = UIColor(red: 0.9608, green: 0.9608, blue: 0.9686, alpha: 1)
        bridgeViewController.webView?.scrollView.bounces = false
        bridgeViewController.webView?.scrollView.alwaysBounceVertical = false
        bridgeViewController.webView?.scrollView.contentInsetAdjustmentBehavior = .never
        bridgeViewController.webView?.backgroundColor = appBackground
        bridgeViewController.webView?.scrollView.backgroundColor = appBackground
    }

    private func dispatchSeedUrlToWebView(_ url: URL) {
        let escapedUrl = url.absoluteString
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let script = """
        localStorage.setItem('seed-pending-action', 'new-seed');
        window.dispatchEvent(new CustomEvent('seed:native-url', { detail: { url: '\(escapedUrl)' } }));
        """

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            guard let bridgeViewController = self?.window?.rootViewController as? CAPBridgeViewController else {
                return
            }

            bridgeViewController.webView?.evaluateJavaScript(script)
        }
    }

}
