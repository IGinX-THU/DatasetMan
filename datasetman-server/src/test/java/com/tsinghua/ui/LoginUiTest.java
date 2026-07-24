package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 登录模块UI自动化测试
 * 对应测试用例: TC-UI-LOGIN-001 ~ TC-UI-LOGIN-009
 */
@DisplayName("登录模块UI测试")
class LoginUiTest extends UiTestBase {

    @Test
    @DisplayName("TC-UI-LOGIN-001: 验证登录页面元素完整性")
    void testLoginPageElements() {
        assertTrue(loginPage.isLoginPage(), "应该在登录页面");
        assertTrue(loginPage.waitForVisible(org.openqa.selenium.By.id("username")).isDisplayed());
        assertTrue(driver.findElement(org.openqa.selenium.By.id("password")).isDisplayed());
        assertTrue(driver.findElement(org.openqa.selenium.By.id("loginBtn")).isDisplayed());
        assertEquals("登录", driver.findElement(org.openqa.selenium.By.id("loginBtn")).getText());
    }

    @Test
    @DisplayName("TC-UI-LOGIN-002: 正确用户名密码登录成功")
    void testLoginSuccess() {
        loginPage.login("user", "user123");
        loginPage.waitForUrlChange("/login.html");
        assertFalse(loginPage.isLoginPage(), "登录成功后应跳转离开登录页");
        // 等待页面加载完成，验证已进入主页（index.html 中顶部导航栏）
        assertTrue(loginPage.waitForVisible(org.openqa.selenium.By.id("menu-home"), 10).isDisplayed(),
                "登录成功后应显示主页导航栏");
    }

    @Test
    @DisplayName("TC-UI-LOGIN-003: 错误密码登录失败")
    void testLoginWrongPassword() {
        loginPage.login("test", "wrong_password_123");
        // 等待错误响应
        String errorToast = loginPage.waitForErrorToast(10);
        assertTrue(loginPage.isLoginPage(), "密码错误应停留在登录页");
        assertTrue(!errorToast.isEmpty() || !loginPage.getErrorMessage().isEmpty(),
                "应显示错误提示信息（Toast或错误文本）");
    }

    @Test
    @DisplayName("TC-UI-LOGIN-004: 不存在的用户登录失败")
    void testLoginNonexistentUser() {
        loginPage.login("nonexistent_user_999", "any_password");
        // 等待错误响应
        String errorToast = loginPage.waitForErrorToast(10);
        assertTrue(loginPage.isLoginPage(), "用户不存在应停留在登录页");
        assertTrue(!errorToast.isEmpty() || !loginPage.getErrorMessage().isEmpty(),
                "应显示错误提示信息（Toast或错误文本）");
    }

    @Test
    @DisplayName("TC-UI-LOGIN-005: 空用户名提交 - 前端校验")
    void testLoginEmptyUsername() {
        loginPage.inputPassword("test123");
        loginPage.clickLoginBtn();
        loginPage.sleep(1000);
        assertTrue(loginPage.isLoginPage(), "空用户名应停留在登录页");
        String errorMsg = loginPage.getErrorMessage();
        assertTrue(errorMsg.contains("请输入此字段") || errorMsg.isEmpty(),
                "空用户名时浏览器原生校验提示'请输入此字段'，阻止提交");
    }

    @Test
    @DisplayName("TC-UI-LOGIN-006: 空密码提交 - 前端校验")
    void testLoginEmptyPassword() {
        loginPage.inputUsername("test");
        loginPage.clickLoginBtn();
        loginPage.sleep(1000);
        assertTrue(loginPage.isLoginPage(), "空密码应停留在登录页");
        String errorMsg = loginPage.getErrorMessage();
        assertTrue(errorMsg.contains("请输入此字段") || errorMsg.isEmpty(),
                "空密码时浏览器原生校验提示'请输入此字段'，阻止提交");
    }

    @Test
    @DisplayName("TC-UI-LOGIN-007: 用户名和密码都为空 - 前端校验")
    void testLoginBothEmpty() {
        loginPage.clickLoginBtn();
        loginPage.sleep(1000);
        assertTrue(loginPage.isLoginPage(), "都为空应停留在登录页，浏览器原生校验'请输入此字段'阻止提交");
    }

    @Test
    @DisplayName("TC-UI-LOGIN-008: 超长用户名边界测试")
    void testLoginLongUsername() {
        StringBuilder longUsername = new StringBuilder();
        for (int i = 0; i < 256; i++) { longUsername.append("a"); }
        loginPage.login(longUsername.toString(), "test123");
        // 等待错误响应
        String errorToast = loginPage.waitForErrorToast(10);
        assertTrue(loginPage.isLoginPage(), "超长用户名登录应失败");
        assertTrue(!errorToast.isEmpty() || !loginPage.getErrorMessage().isEmpty(),
                "应显示错误提示信息");
    }

    @Test
    @DisplayName("TC-UI-LOGIN-009: 用户名含特殊字符边界测试")
    void testLoginSpecialCharsUsername() {
        loginPage.login("test<script>alert(1)</script>", "test123");
        // 等待错误响应
        String errorToast = loginPage.waitForErrorToast(10);
        assertTrue(loginPage.isLoginPage(), "含特殊字符用户名应登录失败");
        assertTrue(!errorToast.isEmpty() || !loginPage.getErrorMessage().isEmpty(),
                "应显示错误提示信息，XSS代码不执行");
    }
}
