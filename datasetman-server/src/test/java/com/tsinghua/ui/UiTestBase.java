package com.tsinghua.ui;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.*;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;

/**
 * UI测试基类 - 提供WebDriver初始化和登录fixture
 * 所有UI测试类继承此类
 */
public abstract class UiTestBase {

    protected static WebDriver driver;
    protected LoginPage loginPage;
    protected HomePage homePage;

    private static final String BASE_URL = System.getenv().getOrDefault("TEST_BASE_URL", "http://localhost:8080");
    private static final String TEST_USERNAME = System.getenv().getOrDefault("TEST_USER", "user");
    private static final String TEST_PASSWORD = System.getenv().getOrDefault("TEST_PASS", "user123");

    @BeforeAll
    static void setUpClass() {
        WebDriverManager.chromedriver().setup();
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
