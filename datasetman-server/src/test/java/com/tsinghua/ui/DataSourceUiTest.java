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
 * 对应测试用例: TC-UI-DS-001 ~ TC-UI-DS-017
 * 覆盖10种数据源类型: IoTDB、InfluxDB、Filesystem、MongoDB、Redis、
 *                   以及关系型数据库5种子引擎(MySQL、PostgreSQL、Oracle、OceanBase、达梦)
 */
@DisplayName("数据源管理模块UI测试")
class DataSourceUiTest extends UiTestBase {

    private static final String HOST_REGISTER = "register-data-resource-embedded";

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
        WebElement registerForm = loginPage.findInShadowById(HOST_REGISTER, "registerForm");
        assertTrue(registerForm.isDisplayed(), "注册数据源表单应可见");
    }

    @Test
    @DisplayName("TC-UI-DS-004: 验证数据源类型下拉选项")
    void testRegisterDataSourceTypeDropdown() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        Select typeSelect = new Select(loginPage.findInShadowById(HOST_REGISTER, "dataSourceType"));
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
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "1");
        loginPage.sleep(500);
        loginPage.clickInShadowById(HOST_REGISTER, "submitBtn");
        loginPage.sleep(1000);
        WebElement registerForm = loginPage.findInShadowById(HOST_REGISTER, "registerForm");
        assertTrue(registerForm.isDisplayed(), "必填字段未填应阻止提交");
    }

    @Test
    @DisplayName("TC-UI-DS-006: 注册数据源 - 取消操作")
    void testRegisterCancel() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.clickInShadowById(HOST_REGISTER, "cancelBtn");
        loginPage.sleep(1000);
        assertTrue(loginPage.isShadowHostHidden(HOST_REGISTER), "取消后注册组件应隐藏");
    }

    // ===== 10种数据源类型字段验证 =====

    @Test
    @DisplayName("TC-UI-DS-007: 注册IoTDB - 验证特定字段显示")
    void testRegisterIotdbFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "1");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "iotdbFields").isDisplayed(),
                "IoTDB特定字段应可见");
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "authFields").isDisplayed(),
                "IoTDB需要认证字段");
    }

    @Test
    @DisplayName("TC-UI-DS-008: 注册InfluxDB - 验证特定字段显示")
    void testRegisterInfluxdbFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "2");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "influxdbFields").isDisplayed(),
                "InfluxDB特定字段应可见");
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "authFields").isDisplayed(),
                "InfluxDB需要认证字段");
    }

    @Test
    @DisplayName("TC-UI-DS-009: 注册Filesystem - 验证特定字段显示")
    void testRegisterFilesystemFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "3");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "filesystemFields").isDisplayed(),
                "Filesystem特定字段应可见");
        assertFalse(loginPage.findInShadowById(HOST_REGISTER, "authFields").isDisplayed(),
                "Filesystem不需要认证字段");
    }

    @Test
    @DisplayName("TC-UI-DS-010: 注册MongoDB - 验证特定字段显示")
    void testRegisterMongodbFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "5");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "mongodbFields").isDisplayed(),
                "MongoDB特定字段应可见");
        assertFalse(loginPage.findInShadowById(HOST_REGISTER, "authFields").isDisplayed(),
                "MongoDB不需要认证字段");
    }

    @Test
    @DisplayName("TC-UI-DS-011: 注册Redis - 验证特定字段显示")
    void testRegisterRedisFields() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "6");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "redisFields").isDisplayed(),
                "Redis特定字段应可见");
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "authFields").isDisplayed(),
                "Redis需要认证字段");
    }

    @Test
    @DisplayName("TC-UI-DS-012: 注册关系型数据库 - MySQL引擎")
    void testRegisterRelationalMysql() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "4");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "relationalFields").isDisplayed(),
                "关系型数据库特定字段应可见");
        loginPage.selectInShadowById(HOST_REGISTER, "engine", "mysql");
        Select engineSelect = new Select(loginPage.findInShadowById(HOST_REGISTER, "engine"));
        assertEquals("mysql", engineSelect.getFirstSelectedOption().getAttribute("value"),
                "应选中MySQL引擎");
    }

    @Test
    @DisplayName("TC-UI-DS-013: 注册关系型数据库 - PostgreSQL引擎")
    void testRegisterRelationalPostgresql() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "4");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "relationalFields").isDisplayed(),
                "关系型数据库特定字段应可见");
        loginPage.selectInShadowById(HOST_REGISTER, "engine", "postgresql");
        Select engineSelect = new Select(loginPage.findInShadowById(HOST_REGISTER, "engine"));
        assertEquals("postgresql", engineSelect.getFirstSelectedOption().getAttribute("value"),
                "应选中PostgreSQL引擎");
    }

    @Test
    @DisplayName("TC-UI-DS-014: 注册关系型数据库 - Oracle引擎")
    void testRegisterRelationalOracle() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "4");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "relationalFields").isDisplayed(),
                "关系型数据库特定字段应可见");
        loginPage.selectInShadowById(HOST_REGISTER, "engine", "oracle");
        Select engineSelect = new Select(loginPage.findInShadowById(HOST_REGISTER, "engine"));
        assertEquals("oracle", engineSelect.getFirstSelectedOption().getAttribute("value"),
                "应选中Oracle引擎");
    }

    @Test
    @DisplayName("TC-UI-DS-015: 注册关系型数据库 - OceanBase引擎")
    void testRegisterRelationalOceanbase() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "4");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "relationalFields").isDisplayed(),
                "关系型数据库特定字段应可见");
        loginPage.selectInShadowById(HOST_REGISTER, "engine", "oceanbase");
        Select engineSelect = new Select(loginPage.findInShadowById(HOST_REGISTER, "engine"));
        assertEquals("oceanbase", engineSelect.getFirstSelectedOption().getAttribute("value"),
                "应选中OceanBase引擎");
    }

    @Test
    @DisplayName("TC-UI-DS-016: 注册关系型数据库 - 达梦引擎")
    void testRegisterRelationalDameng() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "4");
        loginPage.sleep(500);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "relationalFields").isDisplayed(),
                "关系型数据库特定字段应可见");
        loginPage.selectInShadowById(HOST_REGISTER, "engine", "dm");
        Select engineSelect = new Select(loginPage.findInShadowById(HOST_REGISTER, "engine"));
        assertEquals("dm", engineSelect.getFirstSelectedOption().getAttribute("value"),
                "应选中Dameng引擎");
    }

    @Test
    @DisplayName("TC-UI-DS-017: 注册数据源 - 非法端口边界测试")
    void testRegisterInvalidPort() {
        doLogin();
        homePage.goToRegisterDataSource();
        loginPage.sleep(1000);
        loginPage.selectInShadowById(HOST_REGISTER, "dataSourceType", "1");
        loginPage.sleep(500);
        loginPage.inputInShadowById(HOST_REGISTER, "host", "127.0.0.1");
        WebElement portInput = loginPage.findInShadowById(HOST_REGISTER, "port");
        portInput.clear();
        portInput.sendKeys("-1");
        loginPage.inputInShadowById(HOST_REGISTER, "schemaPrefix", "test");
        loginPage.clickInShadowById(HOST_REGISTER, "submitBtn");
        loginPage.sleep(1000);
        assertTrue(loginPage.findInShadowById(HOST_REGISTER, "registerForm").isDisplayed(),
                "非法端口应阻止提交");
    }
}
