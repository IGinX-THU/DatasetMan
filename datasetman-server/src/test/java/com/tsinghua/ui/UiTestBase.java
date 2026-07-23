package com.tsinghua.ui;

import org.junit.jupiter.api.*;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

/**
 * UI测试基类 - 提供WebDriver初始化和登录fixture
 * 所有UI测试类继承此类
 * 使用 Chrome 浏览器，驱动已内置在项目中，完全离线运行，无需任何配置
 */
public abstract class UiTestBase {

    protected static WebDriver driver;
    protected LoginPage loginPage;
    protected HomePage homePage;

    private static final String BASE_URL = System.getenv().getOrDefault("TEST_BASE_URL", "http://localhost:8081");
    private static final String TEST_USERNAME = System.getenv().getOrDefault("TEST_USER", "user");
    private static final String TEST_PASSWORD = System.getenv().getOrDefault("TEST_PASS", "user123");

    @BeforeAll
    static void setUpClass() {
        // 使用项目内置的 chromedriver.exe，完全离线，无需任何配置
        String driverPath = System.getenv("CHROME_DRIVER_PATH");
        if (driverPath == null || driverPath.isEmpty()) {
            // 始终从 src/test/resources/driver 读取，避免 Maven 复制时的文件锁问题
            String baseDir = System.getProperty("user.dir");
            java.io.File driverFile = new java.io.File(baseDir + "/src/test/resources/driver/chromedriver.exe");
            if (!driverFile.exists()) {
                throw new RuntimeException("未找到 chromedriver.exe，请确认文件位于 src/test/resources/driver/ 目录下");
            }
            driverPath = driverFile.getAbsolutePath();
        }
        System.setProperty("webdriver.chrome.driver", driverPath);
    }

    @BeforeEach
    void setUp() {
        ChromeOptions options = new ChromeOptions();
        // 无头模式（CI环境取消注释）
        // options.addArguments("--headless=new");
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--window-size=1920,1080");
        options.addArguments("--disable-gpu");
        options.addArguments("--remote-allow-origins=*");
        options.setExperimentalOption("excludeSwitches", new String[]{"enable-automation"});

        driver = new ChromeDriver(options);
        driver.manage().timeouts().implicitlyWait(java.time.Duration.ofSeconds(10));
        driver.manage().timeouts().pageLoadTimeout(java.time.Duration.ofSeconds(30));
        driver.get(BASE_URL + "/login.html");

        loginPage = new LoginPage(driver);
        homePage = new HomePage(driver);
    }

    @AfterEach
    void tearDown() {
        if (driver != null) {
            driver.quit();
        }
    }

    /**
     * 执行登录操作，等待跳转离开登录页
     */
    protected void doLogin() {
        loginPage.login(TEST_USERNAME, TEST_PASSWORD);
        loginPage.waitForUrlChange("/login.html");
    }

    /**
     * 获取基础URL
     */
    protected String getBaseUrl() {
        return BASE_URL;
    }
}
