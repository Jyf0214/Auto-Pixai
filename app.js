const puppeteer = require("puppeteer");
const url = "https://pixai.art/login";
// 因為 window 的 USERNAME 撞名
const username = process.env.LOGINNAME ? process.env.LOGINNAME : undefined;
const password = process.env.PASSWORD ? process.env.PASSWORD : undefined;
// 如果需要在本地運行，請將這裡改成 false
const isDocker = true;

function delay(time) {
	return new Promise(function (resolve) {
		setTimeout(resolve, time);
	});
}

async function loginAndScrape(url, username, password, isDocker) {
	console.log("帳號:", username);
	if (username == undefined || password == undefined) {
		throw new Error("請在環境變數設置帳號密碼");
	}

	let config = {
		// 如果想要看到瀏覽器，可以將 headless 設置為 false
		headless: true,
	};

	if (isDocker) {
		config = {
			...config,
			executablePath: "/usr/bin/google-chrome",
			args: [
				"--disable-gpu",
				"--disable-setuid-sandbox",
				"--no-sandbox",
				"--no-zygote",
			],
		};
	}

	// 使用 Puppeteer 進行模擬瀏覽器操作
	const browser = await puppeteer.launch(config); //

	const page = await browser.newPage();
	await page.goto(url);

	// 點擊取消初始畫面
	await page.waitForSelector('div[id="root"] > div > div > button');
	await page.click('div[id="root"] > div > div > button');

	console.log("登入");
	await login(page, username, password);

	console.log("展開使用者列表");
	await selectProfileButton(page);

	console.log("點擊檔案列表");
	await clickProfile(page);

	console.log("領取每日獎勵");
	await claimCredit(page);

	// 爬取完成後，關閉瀏覽器
	await browser.close();
}

//#region 登入
async function login(page, username, password) {
	await page.type("#email-input", username);
	await page.type("#password-input", password);
	await page.click('button[type="submit"]');
}

//#endregion

//#region 點擊彈窗
async function checkPopup(page) {
	console.log("Checking for popup");
	try {
		// check for popup
		await page.click('//*[@id="app"]/body/div[4]/div[3]/div/div[2]/div/button');
		return true;
	} catch {
		try {
			// check for popup for browser is fullscreen
			await page.click('//*[@id="app"]/body/div[2]/div[3]/div/div/button');
			return true;
		} catch {
			return false;
		}
	}
}
//#endregion

//#region 點擊頁首圖標
async function selectProfileButton(driver) {
	while (true) {
		try {
			// 確認是否已登入
			const headerText = await driver.$eval(
				"header > div:nth-of-type(2)",
				(el) => el.innerText
			);
			if (headerText.includes("Sign Up") || headerText.includes("Log in")) {
				continue;
			} else {
				throw new Error();
			}
		} catch {
			await delay(300);
			const isPopupClosed = await checkPopup(driver);
			try {
				// 檢查個人資料頭像並點擊
				await driver.$eval("header > img", (el) => el.click());
				await delay(300);
				break;
			} catch {
				try {
					// 如果沒有頭像的話會是div
					await driver.$eval("header > div", (el) => el.click());
					await delay(300);
					break;
				} catch {
					try {
						// 檢查密碼錯誤
						await driver.$eval(
							'svg[data-testid="ReportProblemOutlinedIcon"]',
							(el) => el
						);
						throw new Error(username, "登入失敗！");
					} catch {
						if (!isPopupClosed) {
							await checkPopup(driver);
						}
					}
				}
			}
		}
		await delay(49);
	}
}
//#endregion

//#region 點擊個人檔案

async function clickProfile(page) {
	while (true) {
		try {
			// 在下拉式選單中找到並點擊個人資料按鈕
			await page.click("ul[role='menu'] > li[role='menuitem']:nth-of-type(1)");
			await delay(300);
			break;
		} catch {
			// 如果有頭像會是img
			try {
				await page.click("header > img");
				await delay(300);
				continue;
			} catch {
				if (!(await checkPopup(page))) {
					await page.click("header > div");
					await delay(300);
					continue;
				} else {
					await delay(300);
					continue;
				}
			}
		}
	}
}

//#endregion

//#region 點擊每日獎勵
async function claimCredit(page) {
	let isClaimed = false;
	checkIsClaimed: while (true) {
		try {
			if (isClaimed) {
				console.log("已領取過獎勵");
				break;
			}
			const claimBtnText = await page.$eval(
				"section > div > div:nth-of-type(2) > div:nth-of-type(2) > button > span",
				(el) => el.innerText
			);
			if (claimBtnText.toLowerCase() !== "claimed") {
				miniClaimLoop: while (true) {
					// 領取！
					await page.click(
						"section > div > div:nth-of-type(2) > div:nth-of-type(2) > button"
					);
					await delay(300);
					await page.reload();
					await delay(300);
					const updatedClaimBtnText = await page.$eval(
						"section > div > div:nth-of-type(2) > div:nth-of-type(2) > button > span",
						(el) => el.innerText
					);

					// 確認是不是 "Claimed"
					if (updatedClaimBtnText.toLowerCase() === "claimed") {
						console.log("領取成功");
						isClaimed = true;
						continue checkIsClaimed;
					}
				}
			} else {
				isClaimed = true;
				continue checkIsClaimed;
			}
		} catch {
			if (!(await checkPopup(page))) {
				await delay(500);
				if (!isClaimed) {
					await page.click(
						"section > div > div:nth-of-type(2) > div:nth-of-type(2) > button"
					);
					continue checkIsClaimed;
				} else {
					break;
				}
			} else {
				throw new Error(
					"不知道出啥狀況了，希望能請您蒐集詳細情報並至 GitHub 回報"
				);
				break;
			}
		}
	}
}
//#endregion

loginAndScrape(url, username, password, isDocker)
	.then(() => console.log("領取成功"))
	.catch((error) => console.error("異常：", error));