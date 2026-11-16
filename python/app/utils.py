def topic_name_of(topic_arn: str) -> str:
    """`arn:aws:sns:region:account:name` からトピック名を取り出す"""
    return topic_arn.split(":")[-1]
