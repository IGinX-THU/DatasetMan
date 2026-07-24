package com.tsinghua.ui;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.interactions.Actions;

import java.time.Duration;
import java.util.List;

/**
 * 页面基类 - 所有Page Object的父类，封装常用WebDriver操作
 */
public abstract class BasePage {

    protected final WebDriver driver;
    protected final WebDriverWait wait;
    protected final Actions actions;

    public BasePage(WebDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(10));
        this.actions = new Actions(driver);
    }

    // ============ 元素查找 ============
    public WebElement find(By by) {
        return driver.findElement(by);
    }

    public List<WebElement> finds(By by) {
        return driver.findElements(by);
    }

    public WebElement findById(String id) {
        return find(By.id(id));
    }

    public WebElement findByCss(String css) {
        return find(By.cssSelector(css));
    }

    public WebElement findByXpath(String xpath) {
        return find(By.xpath(xpath));
    }

    public WebElement findByText(String text) {
        return findByXpath("//*[contains(text(),'" + text + "')]");
    }

    // ============ 等待 ============
    public WebElement waitForVisible(By by) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(by));
    }

    public WebElement waitForVisible(By by, int timeoutSeconds) {
        return new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds))
                .until(ExpectedConditions.visibilityOfElementLocated(by));
    }

    public WebElement waitForClickable(By by) {
        return wait.until(ExpectedConditions.elementToBeClickable(by));
    }

    public WebElement waitForClickable(WebElement element) {
        return wait.until(ExpectedConditions.elementToBeClickable(element));
    }

    public WebElement waitForPresence(By by) {
        return wait.until(ExpectedConditions.presenceOfElementLocated(by));
    }

    public boolean waitForHidden(By by) {
        return wait.until(ExpectedConditions.invisibilityOfElementLocated(by));
    }

    public void waitForUrlChange(String oldUrlFragment) {
        wait.until(driver -> !driver.getCurrentUrl().contains(oldUrlFragment));
    }

    // ============ 输入操作 ============
    public void inputText(WebElement element, String text) {
        element.clear();
        element.sendKeys(text);
    }

    public void inputById(String id, String text) {
        inputText(findById(id), text);
    }

    // ============ 点击操作 ============
    public void click(WebElement element) {
        waitForClickable(element);
        element.click();
    }

    public void clickById(String id) {
        click(findById(id));
    }

    public void clickByCss(String css) {
        click(findByCss(css));
    }

    // ============ 下拉选择 ============
    public void selectByValue(String selectId, String value) {
        new Select(findById(selectId)).selectByValue(value);
    }

    public void selectByVisibleText(String selectId, String text) {
        new Select(findById(selectId)).selectByVisibleText(text);
    }

    // ============ 模态框操作 ============
    public WebElement waitForModal(String modalId) {
        return waitForVisible(By.id(modalId));
    }

    // ============ 接口响应等待 ============

    /**
     * 等待成功Toast出现（接口返回成功）
     * 前端通过 showToast(message, 'success') 显示绿色提示
     */
    public String waitForSuccessToast(int timeoutSeconds) {
        WebDriverWait toastWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        try {
            WebElement toast = toastWait.until(ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(".toast-success")));
            return toast.getText();
        } catch (Exception e) {
            return "";
        }
    }

    public String waitForSuccessToast() {
        return waitForSuccessToast(15);
    }

    /**
     * 等待错误Toast出现（接口返回失败）
     * 前端通过 showToast(message, 'error') 显示红色提示
     */
    public String waitForErrorToast(int timeoutSeconds) {
        WebDriverWait toastWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        try {
            WebElement toast = toastWait.until(ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(".toast-error")));
            return toast.getText();
        } catch (Exception e) {
            return "";
        }
    }

    public String waitForErrorToast() {
        return waitForErrorToast(15);
    }

    /**
     * 等待任意Toast出现（成功或失败）
     */
    public String waitForAnyToast(int timeoutSeconds) {
        WebDriverWait toastWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        try {
            WebElement toast = toastWait.until(ExpectedConditions.visibilityOfElementLocated(
                    By.cssSelector(".toast-success, .toast-error")));
            return toast.getText();
        } catch (Exception e) {
            return "";
        }
    }

    public String waitForAnyToast() {
        return waitForAnyToast(15);
    }

    /**
     * 获取当前显示的Toast类型
     * @return "success" / "error" / ""
     */
    public String getToastType() {
        try {
            if (driver.findElement(By.cssSelector(".toast-success")).isDisplayed()) {
                return "success";
            }
        } catch (Exception ignored) {}
        try {
            if (driver.findElement(By.cssSelector(".toast-error")).isDisplayed()) {
                return "error";
            }
        } catch (Exception ignored) {}
        return "";
    }

    /**
     * 等待模态框关闭（接口成功后前端关闭弹窗）
     */
    public boolean waitForModalClosed(String modalSelector, int timeoutSeconds) {
        WebDriverWait closeWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        try {
            return closeWait.until(ExpectedConditions.invisibilityOfElementLocated(
                    By.cssSelector(modalSelector)));
        } catch (Exception e) {
            return false;
        }
    }

    public boolean waitForModalClosed(String modalSelector) {
        return waitForModalClosed(modalSelector, 15);
    }

    /**
     * 等待元素变为不可见（如弹窗关闭、表单消失）
     */
    public boolean waitForElementHidden(By by, int timeoutSeconds) {
        WebDriverWait hideWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        try {
            return hideWait.until(ExpectedConditions.invisibilityOfElementLocated(by));
        } catch (Exception e) {
            return false;
        }
    }

    public boolean waitForElementHidden(By by) {
        return waitForElementHidden(by, 15);
    }

    // ============ 表格操作 ============
    public List<WebElement> getTableRows(String tableBodyId) {
        return findById(tableBodyId).findElements(By.tagName("tr"));
    }

    public int getRowCount(String tableBodyId) {
        return getTableRows(tableBodyId).size();
    }

    public List<WebElement> getTableHeaders(String componentId) {
        return findByCss("#" + componentId + " th").findElements(By.xpath(".."))
                .get(0).findElements(By.tagName("th"));
    }

    // ============ 菜单导航 ============
    public void hoverDropdown(String dropdownId) {
        WebElement dropdown = findById(dropdownId);
        actions.moveToElement(dropdown).perform();
        sleep(300);
        executeJs("arguments[0].classList.add('active');", dropdown);
        sleep(500);
    }

    // ============ 工具方法 ============
    public void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public String getCurrentUrl() {
        return driver.getCurrentUrl();
    }

    public boolean isLoginPage() {
        return getCurrentUrl().contains("login.html");
    }

    public void takeScreenshot(String name) {
        try {
            byte[] screenshot = ((TakesScreenshot) driver).getScreenshotAs(OutputType.BYTES);
            io.qameta.allure.Allure.addAttachment(name, "image/png",
                    new java.io.ByteArrayInputStream(screenshot), ".png");
        } catch (Exception e) {
            // ignore screenshot failures
        }
    }

    public Object executeJs(String script, Object... args) {
        return ((JavascriptExecutor) driver).executeScript(script, args);
    }

    // ============ Shadow DOM 操作 ============

    /**
     * 获取自定义元素的 Shadow Root
     */
    public WebElement getShadowHost(String cssSelector) {
        return waitForVisible(By.cssSelector(cssSelector));
    }

    public boolean isShadowHostHidden(String cssSelector) {
        try {
            WebElement host = driver.findElement(By.cssSelector(cssSelector));
            return !host.isDisplayed();
        } catch (Exception e) {
            return true;
        }
    }

    /**
     * 在 Shadow DOM 中查找元素
     */
    public WebElement findInShadow(String hostCssSelector, String innerCssSelector) {
        WebElement host = getShadowHost(hostCssSelector);
        return host.getShadowRoot().findElement(By.cssSelector(innerCssSelector));
    }

    /**
     * 在 Shadow DOM 中通过 id 查找元素
     */
    public WebElement findInShadowById(String hostCssSelector, String id) {
        return findInShadow(hostCssSelector, "#" + id);
    }

    /**
     * 在 Shadow DOM 中点击元素
     */
    public void clickInShadow(String hostCssSelector, String innerCssSelector) {
        WebElement el = findInShadow(hostCssSelector, innerCssSelector);
        waitForClickable(el);
        el.click();
    }

    /**
     * 在 Shadow DOM 中通过 id 点击元素
     */
    public void clickInShadowById(String hostCssSelector, String id) {
        clickInShadow(hostCssSelector, "#" + id);
    }

    /**
     * 在 Shadow DOM 中输入文本
     */
    public void inputInShadow(String hostCssSelector, String innerCssSelector, String text) {
        WebElement el = findInShadow(hostCssSelector, innerCssSelector);
        el.clear();
        el.sendKeys(text);
    }

    /**
     * 在 Shadow DOM 中通过 id 输入文本
     */
    public void inputInShadowById(String hostCssSelector, String id, String text) {
        inputInShadow(hostCssSelector, "#" + id, text);
    }

    /**
     * 在 Shadow DOM 中通过 id 选择下拉框
     */
    public void selectInShadowById(String hostCssSelector, String id, String value) {
        new Select(findInShadowById(hostCssSelector, id)).selectByValue(value);
    }

    /**
     * 在 Shadow DOM 中等待元素可见
     */
    public WebElement waitForVisibleInShadow(String hostCssSelector, String innerCssSelector, int timeoutSeconds) {
        WebDriverWait shadowWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        return shadowWait.until(d -> {
            try {
                WebElement host = d.findElement(By.cssSelector(hostCssSelector));
                return host.getShadowRoot().findElement(By.cssSelector(innerCssSelector));
            } catch (Exception e) {
                return null;
            }
        });
    }

    /**
     * 在 Shadow DOM 中等待元素隐藏
     */
    public boolean waitForHiddenInShadow(String hostCssSelector, String innerCssSelector, int timeoutSeconds) {
        WebDriverWait shadowWait = new WebDriverWait(driver, Duration.ofSeconds(timeoutSeconds));
        return shadowWait.until(d -> {
            try {
                WebElement host = d.findElement(By.cssSelector(hostCssSelector));
                WebElement el = host.getShadowRoot().findElement(By.cssSelector(innerCssSelector));
                return !el.isDisplayed();
            } catch (Exception e) {
                return true;
            }
        });
    }

    /**
     * 在 Shadow DOM 中查找多个元素
     */
    public List<WebElement> findsInShadow(String hostCssSelector, String innerCssSelector) {
        WebElement host = getShadowHost(hostCssSelector);
        return host.getShadowRoot().findElements(By.cssSelector(innerCssSelector));
    }
}
