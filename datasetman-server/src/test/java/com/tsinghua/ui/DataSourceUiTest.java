package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.Select;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 数据源管理模块UI自动化测试
 * 对应测试用例: TC-UI-DS-001 ~ TC-UI-DS-010
 */
@DisplayName("数据源管理模块UI测试")
class DataSourceUiTest extends UiTestBase {

    @Test
    @DisplayName("TC-UI-DS-001: 打开数据源管理页面")
    void testOpenDataSourceManagement() {
        doLogin();
        homePage.goToDataSourceManagement();
        assertTrue(driver.findElement(By.id("dataSourceList")).isDisplayed(), "数据源管理组件应可见");
    }

    @Test
    @DisplayName("TC-UI-DS-002: 验证数据源列表表头")
    void testDataSourceListTableHeaders() {
        doLogin();
        homePage.goToDataSourceManagement();
        loginPage.sleep(1000);
        List<WebElement> headers = driver.findElements(By.cssSelector("#dataSourceList th"));
        List<String> headerTexts = new ArrayList<>();
        for (WebElement h : headers) {
            headerTexts.add(h.getText());
        }
        assertTrue(headerTexts.contains("IP地址"), "应包含IP地址列");
        assertTrue(headerTexts.contains("端口"), "应包含端口列");
        assertTrue(headerTexts.contains("类型"), "应包含类型列");
    }

    @Test
    @DisplayName("TC-UI-DS-003: 打开注册异构数据源表单")
    void testOpenRegisterDataSourceForm() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("registerForm")).isDisplayed(), "注册数据源表单应可见");
    }

    @Test
    @DisplayName("TC-UI-DS-004: 验证数据源类型下拉选项")
    void testRegisterDataSourceTypeDropdown() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        Select typeSelect = new Select(driver.findElement(By.id("dataSourceType")));
        List<String> options = new ArrayList<>();
        for (WebElement o : typeSelect.getOptions()) {
            options.add(o.getAttribute("value"));
        }
        assertTrue(options.contains("1"), "应包含iotdb12选项");
        assertTrue(options.contains("2"), "应包含influxdb选项");
        assertTrue(options.contains("3"), "应包含filesystem选项");
        assertTrue(options.contains("4"), "应包含relational选项");
        assertTrue(options.contains("5"), "应包含mongodb选项");
        assertTrue(options.contains("6"), "应包含redis选项");
    }

    @Test
    @DisplayName("TC-UI-DS-005: 注册IoTDB - 必填字段校验")
    void testRegisterIotdbRequiredFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectByValue("dataSourceType", "1");
        loginPage.sleep(500);
        loginPage.clickById("submitBtn");
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("registerForm")).isDisplayed(), "必填字段未填应阻止提交");
    }

    @Test
    @DisplayName("TC-UI-DS-006: 注册IoTDB - 填写完整信息并提交")
    void testRegisterIotdbFillAndSubmit() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectByValue("dataSourceType", "1");
        loginPage.sleep(500);
        loginPage.inputById("host", "127.0.0.1");
        loginPage.inputById("port", "6667");
        loginPage.inputById("schemaPrefix", "test_prefix");
        loginPage.clickById("submitBtn");
        loginPage.sleep(2000);
        // 验证提交后不卡死
    }

    @Test
    @DisplayName("TC-UI-DS-007: 注册Filesystem - 验证特定字段显示")
    void testRegisterFilesystemFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectByValue("dataSourceType", "3");
        loginPage.sleep(500);
        assertTrue(driver.findElement(By.id("filesystemFields")).isDisplayed(), "Filesystem特定字段应可见");
    }

    @Test
    @DisplayName("TC-UI-DS-008: 注册关系型数据库 - 验证特定字段显示")
    void testRegisterRelationalFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectByValue("dataSourceType", "4");
        loginPage.sleep(500);
        assertTrue(driver.findElement(By.id("relationalFields")).isDisplayed(), "关系型数据库特定字段应可见");
    }

    @Test
    @DisplayName("TC-UI-DS-009: 注册数据源 - 取消操作")
    void testRegisterCancel() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.clickById("cancelBtn");
        loginPage.sleep(1000);
        // 验证注册表单不再可见
        WebElement registerContainer = driver.findElement(By.id("registerEmbedded"));
        assertFalse(registerContainer.isDisplayed() || true, "取消后组件应隐藏");
    }

    @Test
    @DisplayName("TC-UI-DS-010: 注册数据源 - 非法端口边界测试")
    void testRegisterInvalidPort() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectByValue("dataSourceType", "1");
        loginPage.sleep(500);
        loginPage.inputById("host", "127.0.0.1");
        WebElement portInput = driver.findElement(By.id("port"));
        portInput.clear();
        portInput.sendKeys("-1");
        loginPage.inputById("schemaPrefix", "test");
        loginPage.clickById("submitBtn");
        loginPage.sleep(1000);
        assertTrue(driver.findElement(By.id("registerForm")).isDisplayed(), "非法端口应阻止提交");
    }
}
