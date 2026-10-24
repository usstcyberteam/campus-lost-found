"""公共字段敏感信息脱敏：create_item 保存前对 title/description 做联系方式与宿舍号替换。"""

from tests.test_acceptance import auth, register


def _create(client, token, **extra):
    payload = {
        "direction": "lost",
        "category": "雨伞",
        "title": "丢失雨伞",
        "description": "蓝色折叠伞",
    } | extra
    response = client.post("/api/v1/items", json=payload, headers=auth(token))
    assert response.status_code == 200
    return response.json()


def test_create_masks_phone_number(client):
    token = register(client, "mask_phone")
    item = _create(
        client,
        token,
        description="丢了雨伞，捡到请联系我 13812341234，谢谢",
    )
    assert "13812341234" not in item["description"]
    assert "138****1234" in item["description"]


def test_create_masks_wechat(client):
    token = register(client, "mask_wechat")
    item = _create(
        client,
        token,
        description="微信 wxid_abc123456 可以联系我",
    )
    assert "wxid_abc123456" not in item["description"]
    assert "微信账号已隐藏" in item["description"]


def test_create_masks_wechat_context(client):
    token = register(client, "mask_wechat_ctx")
    item = _create(
        client,
        token,
        description="加微信 student2026 联系",
    )
    assert "student2026" not in item["description"]
    assert "微信账号已隐藏" in item["description"]


def test_create_masks_email(client):
    token = register(client, "mask_email")
    item = _create(
        client,
        token,
        description="捡到的同学发邮件到 student@example.com 呀",
    )
    assert "student@example.com" not in item["description"]
    assert "邮箱已隐藏" in item["description"]


def test_create_masks_qq(client):
    token = register(client, "mask_qq")
    item = _create(
        client,
        token,
        description="QQ: 12345678 联系我",
    )
    assert "12345678" not in item["description"]
    assert "QQ已隐藏" in item["description"]


def test_create_masks_dorm_number(client):
    token = register(client, "mask_dorm")
    item = _create(
        client,
        token,
        description="东西落在宿舍A-302，帮我送回3号楼502",
    )
    assert "A-302" not in item["description"]
    assert "3号楼502" not in item["description"]
    assert item["description"].count("宿舍号已隐藏") == 2


def test_create_masks_title_too(client):
    token = register(client, "mask_title")
    item = _create(
        client,
        token,
        title="丢了校园卡 13812341234",
    )
    assert "13812341234" not in item["title"]
    assert "138****1234" in item["title"]


def test_create_keeps_normal_text(client):
    token = register(client, "mask_normal")
    description = "今天下午3点在图书馆3楼自习区丢了一把蓝色折叠伞，伞柄有磨损，伞面有白色波点"
    item = _create(client, token, description=description)
    assert item["description"] == description
    assert item["title"] == "丢失雨伞"
