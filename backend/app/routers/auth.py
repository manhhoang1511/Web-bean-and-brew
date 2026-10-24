import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from ..schemas import (
    ChangePasswordIn, ForgotPasswordIn, LoginIn, RegisterIn, ResetPasswordIn, TokenOut, UserOut, UserUpdate,
)
from ..security import (
    create_access_token, create_reset_token, get_current_user, hash_password, user_from_reset_token, verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Auth"])
log = logging.getLogger(__name__)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email đã được sử dụng")
    user = User(
        email=email,
        full_name=data.full_name.strip(),
        phone=data.phone,
        hashed_password=hash_password(data.password),
        role="customer",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email hoặc mật khẩu không đúng")
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Thực tế sẽ gửi email chứa link. Bản demo trả link về luôn (demo_reset_url) để dùng ngay.
    Luôn trả cùng một thông báo dù email có tồn tại hay không -> không lộ email nào đã đăng ký."""
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    resp = {"message": "Nếu email tồn tại, liên kết đặt lại mật khẩu đã được gửi (hiệu lực 15 phút)."}
    if user:
        token = create_reset_token(user)
        log.info("Password reset link for %s: /reset-password?token=%s", user.email, token)
        if settings.DEMO_MODE:
            resp["demo_reset_url"] = f"/reset-password?token={token}"
    return resp


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(data: ResetPasswordIn, db: Session = Depends(get_db)):
    user = user_from_reset_token(data.token, db)
    if not user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng")
    user.hashed_password = hash_password(data.new_password)
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(data: ChangePasswordIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mật khẩu hiện tại không đúng")
    user.hashed_password = hash_password(data.new_password)
    db.commit()
