// ========================================
// 当前年份
// ========================================

const currentYear = document.getElementById("currentYear");

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}


// ========================================
// 手机端导航菜单
// ========================================

const menuButton = document.getElementById("menuButton");
const navigation = document.querySelector(".navigation");

if (menuButton && navigation) {

    menuButton.addEventListener("click", () => {
        navigation.classList.toggle("active");
    });

}


// ========================================
// 点击导航链接后自动关闭手机菜单
// ========================================

const navigationLinks = document.querySelectorAll(".navigation a");

navigationLinks.forEach((link) => {

    link.addEventListener("click", () => {

        if (navigation) {
            navigation.classList.remove("active");
        }

    });

});


// ========================================
// 点击页面其他位置关闭手机菜单
// ========================================

document.addEventListener("click", (event) => {

    if (!menuButton || !navigation) {
        return;
    }

    const clickedInsideMenu =
        navigation.contains(event.target);

    const clickedButton =
        menuButton.contains(event.target);

    if (!clickedInsideMenu && !clickedButton) {
        navigation.classList.remove("active");
    }

});
