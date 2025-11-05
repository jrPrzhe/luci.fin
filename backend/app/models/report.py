from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class ReportType(str, enum.Enum):
    CUSTOM = "custom"
    MONTHLY = "monthly"
    YEARLY = "yearly"
    CATEGORY_ANALYSIS = "category_analysis"
    COMPARISON = "comparison"


class Report(Base):
    __tablename__ = "reports"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Report details
    report_type = Column(Enum(ReportType), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Report data (JSON)
    data = Column(Text, nullable=False)
    
    # Filters
    filters = Column(Text, nullable=True)  # JSON for filters
    
    # Period
    start_date = Column(DateTime(timezone=True), nullable=True)
    end_date = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="reports")
    
    def __repr__(self):
        return f"<Report(id={self.id}, name={self.name}, type={self.report_type})>"

