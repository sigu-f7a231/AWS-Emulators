FROM public.ecr.aws/amazonlinux/amazonlinux:2023-minimal

# Apple Silicon (arm64) uses aarch64, Intel/AMD (amd64) uses x86_64
ARG ARCH=aarch64
ADD https://downloads.aws.com/aws-emulator/packages/aws-emulator/LTS/latest/aws-emulator-${ARCH}.rpm /tmp/aws-emulator.rpm

RUN rpm -i /tmp/aws-emulator.rpm && rm /tmp/aws-emulator.rpm \
    && mkdir -p /root/.aws/emulator \
    && chmod -R 777 /root

ENV HOME=/root
ENV EMULATOR_TELEMETRY=off
EXPOSE 9297

ENTRYPOINT ["aws-emulator", "-b", "0.0.0.0"]
CMD ["-p", "9297", "--auth", "off"]
