package com.tsinghua.ui;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 评价准则与质量测评模块UI自动化测试
 * 对应测试用例: TC-UI-EC-001 ~ TC-UI-EC-008, TC-UI-QA-001 ~ TC-UI-QA-006
 */
@DisplayName("评价准则与质量测评模块UI测试")
class QualityUiTest extends UiTestBase {

    private static final String HOST_EC = "evaluation-criteria";

    @Nested
    @DisplayName("评价准则")
    class EvaluationCriteria {

        @Test
        @DisplayName("TC-UI-EC-001: 打开评价准则页面")
        void testOpenEvaluationCriteria() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            assertFalse(loginPage.isShadowHostHidden(HOST_EC), "评价准则组件应可见");
        }

        @Test
        @DisplayName("TC-UI-EC-002: 验证列表视图可见")
        void testEcListViewVisible() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            assertTrue(loginPage.findInShadowById(HOST_EC, "ecListView").isDisplayed(), "评价准则列表视图应可见");
        }

        @Test
        @DisplayName("TC-UI-EC-003: 验证筛选区域元素")
        void testEcFilterElements() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            assertTrue(loginPage.findInShadowById(HOST_EC, "ecFilterName").isDisplayed());
            assertTrue(loginPage.findInShadowById(HOST_EC, "ecApplyFilters").isDisplayed());
            assertTrue(loginPage.findInShadowById(HOST_EC, "ecResetFilters").isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-EC-004: 验证评价准则表格表头")
        void testEcTableHeaders() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            List<WebElement> headers = loginPage.findsInShadow(HOST_EC, "th");
            List<String> texts = new ArrayList<>();
            for (WebElement h : headers) { texts.add(h.getText()); }
            assertTrue(texts.contains("名称"));
            assertTrue(texts.contains("描述"));
            assertTrue(texts.contains("完整性"));
            assertTrue(texts.contains("一致性"));
            assertTrue(texts.contains("时效性"));
            assertTrue(texts.contains("有效性"));
            assertTrue(texts.contains("操作"));
        }

        @Test
        @DisplayName("TC-UI-EC-005: 打开新增评价准则弹窗")
        void testOpenAddEcModal() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            loginPage.clickInShadowById(HOST_EC, "ecAddBtn");
            loginPage.sleep(1000);
            WebElement modal = loginPage.findInShadowById(HOST_EC, "ecFormModal");
            assertFalse(modal.getAttribute("hidden") != null, "新增评价准则弹窗应可见");
        }

        @Test
        @DisplayName("TC-UI-EC-006: 验证新增评价准则表单元素")
        void testAddEcFormElements() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            loginPage.clickInShadowById(HOST_EC, "ecAddBtn");
            loginPage.sleep(1000);
            assertTrue(loginPage.findInShadowById(HOST_EC, "ecName").isDisplayed());
            assertTrue(loginPage.findInShadowById(HOST_EC, "ecDescription").isDisplayed());
            List<WebElement> weightInputs = loginPage.findsInShadow(HOST_EC, ".ec-weight-input");
            assertEquals(4, weightInputs.size(), "应有4个维度权重输入框");
            List<WebElement> jobSelects = loginPage.findsInShadow(HOST_EC, ".ec-job-select");
            assertEquals(4, jobSelects.size(), "应有4个维度编排选择框");
        }

        @Test
        @DisplayName("TC-UI-EC-007: 验证权重合计显示")
        void testEcWeightSumDisplay() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            loginPage.clickInShadowById(HOST_EC, "ecAddBtn");
            loginPage.sleep(1000);
            WebElement weightSum = loginPage.findInShadowById(HOST_EC, "ecWeightSum");
            assertTrue(weightSum.isDisplayed(), "权重合计应可见");
            assertEquals("1.00", weightSum.getText(), "默认权重合计应为1.00");
        }

        @Test
        @DisplayName("TC-UI-EC-008: 新增评价准则 - 取消操作")
        void testAddEcCancel() {
            doLogin();
            homePage.goToEvaluationCriteria();
            loginPage.sleep(1000);
            loginPage.clickInShadowById(HOST_EC, "ecAddBtn");
            loginPage.sleep(1000);
            loginPage.clickInShadowById(HOST_EC, "ecCancelBtn");
            loginPage.sleep(1000);
            WebElement modal = loginPage.findInShadowById(HOST_EC, "ecFormModal");
            assertTrue(modal.getAttribute("hidden") != null, "取消后弹窗应关闭");
        }
    }

    @Nested
    @DisplayName("质量测评")
    class QualityAssessment {

        @Test
        @DisplayName("TC-UI-QA-001: 打开质量测评页面")
        void testOpenQualityAssessment() {
            doLogin();
            homePage.goToQualityAssessment();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("qualityAssessment")).isDisplayed(), "质量测评组件应可见");
        }

        @Test
        @DisplayName("TC-UI-QA-002: 验证列表视图可见")
        void testQaListViewVisible() {
            doLogin();
            homePage.goToQualityAssessment();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("qaListView")).isDisplayed(), "质量测评列表视图应可见");
        }

        @Test
        @DisplayName("TC-UI-QA-003: 验证筛选区域元素")
        void testQaFilterElements() {
            doLogin();
            homePage.goToQualityAssessment();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("qaFilterName")).isDisplayed());
            assertTrue(driver.findElement(By.id("qaApplyFilters")).isDisplayed());
            assertTrue(driver.findElement(By.id("qaResetFilters")).isDisplayed());
        }

        @Test
        @DisplayName("TC-UI-QA-004: 验证质量测评表格表头")
        void testQaTableHeaders() {
            doLogin();
            homePage.goToQualityAssessment();
            loginPage.sleep(1000);
            List<WebElement> headers = driver.findElements(By.cssSelector("#qualityAssessment th"));
            List<String> texts = new ArrayList<>();
            for (WebElement h : headers) { texts.add(h.getText()); }
            assertTrue(texts.contains("准则名称"));
            assertTrue(texts.contains("提交时间"));
            assertTrue(texts.contains("DQI"));
            assertTrue(texts.contains("操作"));
        }

        @Test
        @DisplayName("TC-UI-QA-005: 质量测评筛选并重置")
        void testQaFilterAndReset() {
            doLogin();
            homePage.goToQualityAssessment();
            loginPage.sleep(1000);
            loginPage.inputById("qaFilterName", "test");
            loginPage.clickById("qaApplyFilters");
            // 等待表格刷新（接口返回数据后表格更新）
            loginPage.waitForVisible(By.id("qaTableBody"), 10);
            loginPage.clickById("qaResetFilters");
            loginPage.sleep(1000);
            assertEquals("", driver.findElement(By.id("qaFilterName")).getAttribute("value"));
        }

        @Test
        @DisplayName("TC-UI-QA-006: 验证空数据提示")
        void testQaEmptyHint() {
            doLogin();
            homePage.goToQualityAssessment();
            loginPage.sleep(1000);
            assertTrue(driver.findElement(By.id("qaTableBody")).isDisplayed(), "质量测评表格body应可见");
        }
    }
}
